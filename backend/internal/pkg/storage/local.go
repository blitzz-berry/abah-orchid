package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"orchidmart-backend/internal/config"
)

const MaxImageSize = 5 << 20
const MaxPaymentProofSize = 10 << 20

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

var allowedPaymentProofTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

type UploadResult struct {
	URL      string `json:"url"`
	Path     string `json:"path"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
}

func SaveImage(fileHeader *multipart.FileHeader, folder string) (*UploadResult, error) {
	return saveUploadedFile(fileHeader, folder, allowedImageTypes, MaxImageSize, "only jpg, png, and webp images are allowed", false)
}

func SavePaymentProof(fileHeader *multipart.FileHeader, folder string) (*UploadResult, error) {
	return saveUploadedFile(fileHeader, folder, allowedPaymentProofTypes, MaxPaymentProofSize, "only jpg, png, webp, and pdf files are allowed", true)
}

func saveUploadedFile(fileHeader *multipart.FileHeader, folder string, allowedTypes map[string]string, maxSize int64, invalidTypeMessage string, private bool) (*UploadResult, error) {
	if fileHeader == nil {
		return nil, errors.New("file is required")
	}
	if fileHeader.Size <= 0 || fileHeader.Size > maxSize {
		return nil, fmt.Errorf("file size must be between 1 byte and %dMB", maxSize>>20)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()

	head := make([]byte, 512)
	n, err := file.Read(head)
	if err != nil && err != io.EOF {
		return nil, err
	}
	mimeType := http.DetectContentType(head[:n])
	ext, ok := allowedTypes[mimeType]
	if !ok {
		return nil, errors.New(invalidTypeMessage)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}

	cleanFolder := strings.Trim(strings.ReplaceAll(folder, "\\", "/"), "/")
	if cleanFolder == "" {
		cleanFolder = "general"
	}
	name := uuid.NewString() + ext
	objectName := cleanFolder + "/" + name
	if strings.EqualFold(os.Getenv("STORAGE_DRIVER"), "s3") {
		return saveS3(file, fileHeader.Size, objectName, mimeType, private)
	}
	root := os.Getenv("UPLOAD_DIR")
	publicBase := os.Getenv("UPLOAD_PUBLIC_URL")
	if private {
		root = os.Getenv("PRIVATE_UPLOAD_DIR")
		publicBase = ""
	}
	if root == "" {
		if private {
			root = "private_uploads"
		} else {
			root = "uploads"
		}
	}
	if !private && publicBase == "" {
		publicBase = "/uploads"
	}
	if !private && config.IsProduction() && publicBase == "/uploads" {
		return nil, errors.New("UPLOAD_PUBLIC_URL is required in production")
	}

	dir := filepath.Join(root, cleanFolder)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	dstPath := filepath.Join(dir, name)
	dst, err := os.Create(dstPath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		return nil, err
	}

	publicPath := paymentProofAccessPath(objectName)
	storedPath := filepath.ToSlash(dstPath)
	if !private {
		publicPath = strings.TrimRight(publicBase, "/") + "/" + cleanFolder + "/" + name
	} else {
		storedPath = objectName
	}
	return &UploadResult{
		URL:      publicPath,
		Path:     storedPath,
		MimeType: mimeType,
		Size:     fileHeader.Size,
	}, nil
}

func saveS3(file multipart.File, size int64, objectName, mimeType string, private bool) (*UploadResult, error) {
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	bucket, err := s3Bucket(private)
	if err != nil {
		return nil, err
	}
	publicBase := os.Getenv("S3_PUBLIC_URL")
	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" || (!private && publicBase == "") {
		return nil, errors.New("S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, and S3_PUBLIC_URL are required when STORAGE_DRIVER=s3")
	}

	useSSL, err := s3UseSSL(endpoint)
	if err != nil {
		return nil, err
	}
	client, err := minio.New(strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://"), &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return nil, err
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, err
		}
	}

	if _, err := client.PutObject(ctx, bucket, objectName, file, size, minio.PutObjectOptions{ContentType: mimeType}); err != nil {
		return nil, err
	}

	publicPath := paymentProofAccessPath(objectName)
	storedPath := bucket + "/" + objectName
	if !private {
		publicPath = strings.TrimRight(publicBase, "/") + "/" + objectName
	} else {
		storedPath = objectName
	}
	return &UploadResult{
		URL:      publicPath,
		Path:     storedPath,
		MimeType: mimeType,
		Size:     size,
	}, nil
}

func OpenPaymentProof(orderID, filename string) (io.ReadCloser, string, error) {
	if !isSafePaymentProofFilename(filename) {
		return nil, "", errors.New("invalid payment proof filename")
	}

	objectName := ImageFolder("payment-proofs", orderID) + "/" + filename
	contentType := mime.TypeByExtension(filepath.Ext(filename))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if strings.EqualFold(os.Getenv("STORAGE_DRIVER"), "s3") {
		return openPaymentProofS3(objectName, contentType)
	}

	root := os.Getenv("PRIVATE_UPLOAD_DIR")
	if root == "" {
		root = "private_uploads"
	}
	path := filepath.Join(root, filepath.FromSlash(objectName))
	file, err := os.Open(path)
	if err != nil {
		return nil, "", err
	}
	return file, contentType, nil
}

func openPaymentProofS3(objectName, contentType string) (io.ReadCloser, string, error) {
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	bucket, err := s3Bucket(true)
	if err != nil {
		return nil, "", err
	}
	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" {
		return nil, "", errors.New("S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_PAYMENT_PROOF_BUCKET are required for private payment proofs")
	}

	useSSL, err := s3UseSSL(endpoint)
	if err != nil {
		return nil, "", err
	}
	client, err := minio.New(strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://"), &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, "", err
	}

	object, err := client.GetObject(context.Background(), bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", err
	}
	info, err := object.Stat()
	if err != nil {
		object.Close()
		return nil, "", err
	}
	if info.ContentType != "" {
		contentType = info.ContentType
	}
	return object, contentType, nil
}

func s3Bucket(private bool) (string, error) {
	publicBucket := strings.TrimSpace(os.Getenv("S3_BUCKET"))
	if !private {
		return publicBucket, nil
	}

	privateBucket := strings.TrimSpace(os.Getenv("S3_PAYMENT_PROOF_BUCKET"))
	if privateBucket == "" {
		if config.IsProduction() {
			return "", errors.New("S3_PAYMENT_PROOF_BUCKET is required in production and must be separate from S3_BUCKET")
		}
		privateBucket = publicBucket
	}
	if config.IsProduction() && publicBucket != "" && privateBucket == publicBucket {
		return "", errors.New("S3_PAYMENT_PROOF_BUCKET must be different from public S3_BUCKET in production")
	}
	return privateBucket, nil
}

func s3UseSSL(endpoint string) (bool, error) {
	useSSL := os.Getenv("S3_USE_SSL") != "false"
	if config.IsProduction() && !useSSL && !isPrivateStorageEndpoint(endpoint) && os.Getenv("S3_ALLOW_INSECURE_SSL") != "true" {
		return false, errors.New("S3_USE_SSL=false is only allowed for local/private storage endpoints in production")
	}
	return useSSL, nil
}

func isPrivateStorageEndpoint(endpoint string) bool {
	host := strings.TrimPrefix(strings.TrimPrefix(endpoint, "https://"), "http://")
	if splitHost, _, err := net.SplitHostPort(host); err == nil {
		host = splitHost
	}
	host = strings.Trim(strings.ToLower(host), "[]")
	if host == "" || host == "localhost" || host == "minio" || strings.HasSuffix(host, ".local") {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate()
}

func paymentProofAccessPath(objectName string) string {
	parts := strings.Split(objectName, "/")
	if len(parts) >= 3 && parts[0] == "payment-proofs" {
		return fmt.Sprintf("/api/v1/payments/%s/proof-file/%s", parts[1], parts[len(parts)-1])
	}
	return "/api/v1/payments/proof-file"
}

func isSafePaymentProofFilename(filename string) bool {
	if filename == "" || filename != filepath.Base(filename) || strings.ContainsAny(filename, `/\`) {
		return false
	}
	ext := strings.ToLower(filepath.Ext(filename))
	for _, allowedExt := range allowedPaymentProofTypes {
		if ext == allowedExt {
			return true
		}
	}
	return false
}

func PublicFileHandler() http.Handler {
	root := os.Getenv("UPLOAD_DIR")
	if root == "" {
		root = "uploads"
	}
	return http.StripPrefix("/uploads/", http.FileServer(http.Dir(root)))
}

func PublicFileSystem() http.FileSystem {
	root := os.Getenv("UPLOAD_DIR")
	if root == "" {
		root = "uploads"
	}
	return http.Dir(root)
}

func ImageFolder(kind, id string) string {
	return fmt.Sprintf("%s/%s", kind, id)
}
