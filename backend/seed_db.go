package main

import (
	"log"
	"orchidmart-backend/internal/model"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=orchidmart password=secretpassword dbname=orchidmart port=5432 sslmode=disable TimeZone=Asia/Jakarta"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 1. Ensure a default Admin exists for StockMovement FK
	var admin model.User
	if err := db.Where("email = ?", "system@orchidmart.com").First(&admin).Error; err != nil {
		admin = model.User{
			ID:           uuid.New(),
			FullName:     "System Admin",
			Email:        "system@orchidmart.com",
			PasswordHash: "hashedpassword",
			Role:         "admin",
		}
		db.Create(&admin)
		log.Println("Created System Admin:", admin.ID)
	}

	// 2. Ensure a default category exists
	var cat model.Category
	if err := db.Where("slug = ?", "default-category").First(&cat).Error; err != nil {
		cat = model.Category{
			ID:   uuid.New(),
			Name: "Koleksi Utama (Default)",
			Slug: "default-category",
		}
		db.Create(&cat)
		log.Println("Created default category:", cat.ID)
	}

	// 3. Define products
	products := []struct {
		Name        string
		Slug        string
		Desc        string
		Price       float64
		Unit        string
		InitialQty  int
	}{
		{
			Name: "Anggrek Bulan (Phalaenopsis amabilis)",
			Slug: "anggrek-bulan-phalaenopsis-amabilis",
			Desc: "Bunga Nasional Indonesia (Puspa Pesona). Memiliki kelopak lebar berwarna putih bersih dengan corak kuning di tengahnya. Sangat cocok untuk hiasan indoor karena bunganya awet dan perawatannya mudah.",
			Price: 150000,
			Unit: "PER_POHON",
			InitialQty: 45,
		},
		{
			Name: "Anggrek Hitam Kalimantan (Coelogyne pandurata)",
			Slug: "anggrek-hitam-kalimantan-coelogyne-pandurata",
			Desc: "Varian sangat langka dan dilindungi. Kelopaknya berwarna hijau cerah dengan lidah (labellum) berwarna hitam pekat. Cocok untuk kolektor tingkat mahir dengan lingkungan tanam terkontrol.",
			Price: 850000,
			Unit: "PER_POHON",
			InitialQty: 3,
		},
		{
			Name: "Anggrek Vanda Tricolor",
			Slug: "anggrek-vanda-tricolor",
			Desc: "Spesies epifit endemik Jawa Timur. Bunganya berukuran sedang dengan corak totol-totol merah kecoklatan berlatar putih/kuning. Sangat menyukai sinar matahari yang melimpah dan sirkulasi udara bebas.",
			Price: 275000,
			Unit: "PER_POHON",
			InitialQty: 12,
		},
		{
			Name: "Bibit Dendrobium Spectabile (Botolan)",
			Slug: "bibit-dendrobium-spectabile-botolan",
			Desc: "Bibit anggrek unik keriting. Dijual dalam bentuk botolan kultur jaringan yang steril. Satu botol berisi +- 25 hingga 30 bibit nener ukuran 1-2 cm. Sangat cocok bagi petani anggrek pembibitan (B2B).",
			Price: 320000,
			Unit: "PER_BATCH",
			InitialQty: 100,
		},
		{
			Name: "Anggrek Cattleya (Semerbak)",
			Slug: "anggrek-cattleya-semerbak",
			Desc: "Dikenal sebagai ratunya anggrek karena ukuran bunganya yang super besar, elegan, dan wanginya yang luar biasa semerbak harum. Berwarna dominan ungu pink cerah. Membutuhkan intensitas cahaya tinggi.",
			Price: 450000,
			Unit: "PER_POHON",
			InitialQty: 18,
		},
	}

	for _, p := range products {
		var existing model.Product
		if err := db.Where("slug = ?", p.Slug).First(&existing).Error; err == nil {
			log.Println("Skipping (already exists):", p.Name)
			continue
		}

		newProduct := model.Product{
			ID:          uuid.New(),
			CategoryID:  cat.ID,
			Name:        p.Name,
			Slug:        p.Slug,
			Description: p.Desc,
			Price:       p.Price,
			UnitType:    p.Unit,
			WeightGram:  500, // Def weight
		}

		// Insert product using transaction so we can also insert inventory
		err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&newProduct).Error; err != nil {
				return err
			}

			// Create Inventory
			inv := model.Inventory{
				ProductID: newProduct.ID,
				Quantity:  p.InitialQty,
			}
			if err := tx.Create(&inv).Error; err != nil {
				return err
			}

			// Create movement log
			sm := model.StockMovement{
				ProductID:     newProduct.ID,
				MovementType:  "STOCK_IN",
				Quantity:      p.InitialQty,
				ReferenceType: "OPNAME",
				Note:          "Seeded Initial Stock from Bot",
				PerformedBy:   admin.ID, // Attach admin ID to satisfy FK constraint
			}
			if err := tx.Create(&sm).Error; err != nil {
				return err
			}

			return nil
		})

		if err != nil {
			log.Println("Error inserting:", p.Name, err)
		} else {
			log.Println("✅ Successfully seeded:", p.Name, "with stock", p.InitialQty)
		}
	}
	
	log.Println("FINISHED SEEDING DATABASE.")
}
