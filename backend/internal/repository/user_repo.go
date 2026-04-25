package repository

import (
	"errors"
	"orchidmart-backend/internal/model"
	"time"

	"github.com/google/uuid"

	"gorm.io/gorm"
)

type UserRepository interface {
	CreateUser(user *model.User) error
	FindByEmail(email string) (*model.User, error)
	FindByID(id string) (*model.User, error)
	UpdateProfile(id, fullName, phone string) (*model.User, error)
	GetAddressesByUserID(userID string) ([]model.Address, error)
	CreateAddress(address *model.Address) error
	UpdateAddress(userID, addressID string, address *model.Address) (*model.Address, error)
	DeleteAddress(userID, addressID string) error
	SetDefaultAddress(userID, addressID string) error
	CreatePasswordReset(reset *model.PasswordReset) error
	FindPasswordResetByToken(token string) (*model.PasswordReset, error)
	MarkPasswordResetUsed(token string) error
	UpdatePassword(userID string, hashedPassword string) error
	CreateRefreshToken(token *model.RefreshToken) error
	FindRefreshToken(token string) (*model.RefreshToken, error)
	RevokeRefreshToken(token string) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db}
}

func (r *userRepository) CreateUser(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *userRepository) FindByEmail(email string) (*model.User, error) {
	var user model.User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByID(id string) (*model.User, error) {
	var user model.User
	err := r.db.Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) UpdateProfile(id, fullName, phone string) (*model.User, error) {
	var user model.User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	user.FullName = fullName
	user.Phone = phone
	user.UpdatedAt = time.Now()

	if err := r.db.Save(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *userRepository) GetAddressesByUserID(userID string) ([]model.Address, error) {
	var addresses []model.Address
	err := r.db.Where("user_id = ?", userID).Order("is_default desc, created_at desc").Find(&addresses).Error
	return addresses, err
}

func (r *userRepository) CreateAddress(address *model.Address) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if address.IsDefault {
			if err := tx.Model(&model.Address{}).
				Where("user_id = ?", address.UserID).
				Update("is_default", false).Error; err != nil {
				return err
			}
		} else {
			var count int64
			if err := tx.Model(&model.Address{}).
				Where("user_id = ?", address.UserID).
				Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				address.IsDefault = true
			}
		}

		return tx.Create(address).Error
	})
}

func (r *userRepository) UpdateAddress(userID, addressID string, address *model.Address) (*model.Address, error) {
	var updated model.Address
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND user_id = ?", addressID, userID).First(&updated).Error; err != nil {
			return err
		}

		if address.IsDefault {
			if err := tx.Model(&model.Address{}).
				Where("user_id = ?", userID).
				Update("is_default", false).Error; err != nil {
				return err
			}
		}

		updated.Label = address.Label
		updated.RecipientName = address.RecipientName
		updated.Phone = address.Phone
		updated.Province = address.Province
		updated.ProvinceID = address.ProvinceID
		updated.City = address.City
		updated.CityID = address.CityID
		updated.District = address.District
		updated.PostalCode = address.PostalCode
		updated.FullAddress = address.FullAddress
		updated.IsDefault = address.IsDefault
		updated.UpdatedAt = time.Now()

		return tx.Save(&updated).Error
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (r *userRepository) DeleteAddress(userID, addressID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var address model.Address
		if err := tx.Where("id = ? AND user_id = ?", addressID, userID).First(&address).Error; err != nil {
			return err
		}

		if err := tx.Delete(&address).Error; err != nil {
			return err
		}

		if !address.IsDefault {
			return nil
		}

		var fallback model.Address
		if err := tx.Where("user_id = ?", userID).Order("created_at asc").First(&fallback).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}

		return tx.Model(&fallback).Update("is_default", true).Error
	})
}

func (r *userRepository) SetDefaultAddress(userID, addressID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Address{}).
			Where("user_id = ?", userID).
			Update("is_default", false).Error; err != nil {
			return err
		}

		result := tx.Model(&model.Address{}).
			Where("id = ? AND user_id = ?", addressID, userID).
			Update("is_default", true)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		return nil
	})
}

func (r *userRepository) CreatePasswordReset(reset *model.PasswordReset) error {
	if reset.ID == uuid.Nil {
		reset.ID = uuid.New()
	}
	return r.db.Create(reset).Error
}

func (r *userRepository) FindPasswordResetByToken(token string) (*model.PasswordReset, error) {
	var reset model.PasswordReset
	err := r.db.Where("token = ?", token).First(&reset).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &reset, nil
}

func (r *userRepository) MarkPasswordResetUsed(token string) error {
	return r.db.Model(&model.PasswordReset{}).
		Where("token = ?", token).
		Update("is_used", true).Error
}

func (r *userRepository) UpdatePassword(userID string, hashedPassword string) error {
	return r.db.Model(&model.User{}).
		Where("id = ?", userID).
		Update("password_hash", hashedPassword).Error
}

func (r *userRepository) CreateRefreshToken(token *model.RefreshToken) error {
	if token.ID == uuid.Nil {
		token.ID = uuid.New()
	}
	return r.db.Create(token).Error
}

func (r *userRepository) FindRefreshToken(token string) (*model.RefreshToken, error) {
	var refreshToken model.RefreshToken
	err := r.db.Where("token = ?", token).First(&refreshToken).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &refreshToken, nil
}

func (r *userRepository) RevokeRefreshToken(token string) error {
	return r.db.Model(&model.RefreshToken{}).Where("token = ?", token).Update("is_revoked", true).Error
}
