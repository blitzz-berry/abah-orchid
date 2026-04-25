package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
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

const maxImageSize = 5 << 20

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type UploadResult struct {
	URL      string `json:"url"`
	Path     string `json:"path"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
}

func SaveImage(fileHeader *multipart.FileHeader, folder string) (*UploadResult, error) {
	if fileHeader == nil {
		return nil, errors.New("file is required")
	}
	if fileHeader.Size <= 0 || fileHeader.Size > maxImageSize {
		return nil, errors.New("image size must be between 1 byte and 5MB")
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
	ext, ok := allowedImageTypes[mimeType]
	if !ok {
		return nil, errors.New("only jpg, png, and webp images are allowed")
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
		return saveImageS3(file, fileHeader.Size, objectName, mimeType)
	}
	root := os.Getenv("UPLOAD_DIR")
	if root == "" {
		root = "uploads"
	}
	publicBase := os.Getenv("UPLOAD_PUBLIC_URL")
	if publicBase == "" {
		publicBase = "/uploads"
	}
	if config.IsProduction() && publicBase == "/uploads" {
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

	publicPath := strings.TrimRight(publicBase, "/") + "/" + cleanFolder + "/" + name
	return &UploadResult{
		URL:      publicPath,
		Path:     filepath.ToSlash(dstPath),
		MimeType: mimeType,
		Size:     fileHeader.Size,
	}, nil
}

func saveImageS3(file multipart.File, size int64, objectName, mimeType string) (*UploadResult, error) {
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	bucket := os.Getenv("S3_BUCKET")
	publicBase := os.Getenv("S3_PUBLIC_URL")
	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" || publicBase == "" {
		return nil, errors.New("S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, and S3_PUBLIC_URL are required when STORAGE_DRIVER=s3")
	}

	useSSL := os.Getenv("S3_USE_SSL") != "false"
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

	return &UploadResult{
		URL:      strings.TrimRight(publicBase, "/") + "/" + objectName,
		Path:     bucket + "/" + objectName,
		MimeType: mimeType,
		Size:     size,
	}, nil
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
