// repositories/user_repository.go
package repositories

import (
	"database/sql"
	"sfaf-plotter/models"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

// GetUserByID retrieves a user by ID
func (r *UserRepository) GetUserByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	query := `SELECT * FROM users WHERE id = $1 AND is_active = true`
	err := r.db.Get(&user, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

// GetByID retrieves a user by ID (alias for compatibility)
func (r *UserRepository) GetByID(id uuid.UUID) (*models.User, error) {
	return r.GetUserByID(id)
}

// GetByUsername retrieves a user by username (alias for compatibility)
func (r *UserRepository) GetByUsername(username string) (*models.User, error) {
	return r.GetUserByUsername(username)
}

// GetUserByUsername retrieves a user by username
func (r *UserRepository) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	query := `SELECT * FROM users WHERE username = $1 AND is_active = true`
	err := r.db.Get(&user, query, username)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

// GetUserByCertificateSerial retrieves a user by certificate serial number
func (r *UserRepository) GetUserByCertificateSerial(serial string) (*models.User, error) {
	var user models.User
	query := `SELECT * FROM users WHERE certificate_serial = $1 AND is_active = true`
	err := r.db.Get(&user, query, serial)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

// CreateUser creates a new user
func (r *UserRepository) CreateUser(user *models.User) error {
	query := `
		INSERT INTO users (id, username, email, password_hash, full_name, organization, role, is_active, certificate_serial, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`

	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		user.ID, user.Username, user.Email, user.PasswordHash, user.FullName,
		user.Organization, user.Role, user.IsActive, user.CertificateSerial,
		user.CreatedAt, user.UpdatedAt,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

// UpdateLastLogin updates user's last login time
func (r *UserRepository) UpdateLastLogin(userID uuid.UUID, loginTime time.Time) error {
	query := `UPDATE users SET last_login = $1, updated_at = $2 WHERE id = $3`
	now := time.Now()
	_, err := r.db.Exec(query, loginTime, now, userID)
	return err
}

// CertificateRepository handles client certificate operations
type CertificateRepository struct {
	db *sqlx.DB
}

func NewCertificateRepository(db *sqlx.DB) *CertificateRepository {
	return &CertificateRepository{db: db}
}

// GetCertificateBySerial retrieves a certificate by serial number
func (r *CertificateRepository) GetCertificateBySerial(serial string) (*models.ClientCertificate, error) {
	var cert models.ClientCertificate
	query := `SELECT * FROM client_certificates WHERE serial_number = $1 AND is_revoked = false`
	err := r.db.Get(&cert, query, serial)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &cert, err
}

// GetCertificateByFingerprint retrieves a certificate by fingerprint
func (r *CertificateRepository) GetCertificateByFingerprint(fingerprint string) (*models.ClientCertificate, error) {
	var cert models.ClientCertificate
	query := `SELECT * FROM client_certificates WHERE fingerprint = $1 AND is_revoked = false`
	err := r.db.Get(&cert, query, fingerprint)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &cert, err
}

// CreateCertificate registers a new client certificate
func (r *CertificateRepository) CreateCertificate(cert *models.ClientCertificate) error {
	query := `
		INSERT INTO client_certificates
		(id, user_id, serial_number, common_name, organization, email_address,
		 issuer, not_before, not_after, fingerprint, is_revoked, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`

	cert.ID = uuid.New()
	cert.CreatedAt = time.Now()
	cert.UpdatedAt = time.Now()
	cert.IsRevoked = false

	return r.db.QueryRow(query,
		cert.ID, cert.UserID, cert.SerialNumber, cert.CommonName,
		cert.Organization, cert.EmailAddress, cert.Issuer,
		cert.NotBefore, cert.NotAfter, cert.Fingerprint, cert.IsRevoked,
		cert.CreatedAt, cert.UpdatedAt,
	).Scan(&cert.ID, &cert.CreatedAt, &cert.UpdatedAt)
}

// UpdateCertificateLastUsed updates the last used timestamp
func (r *CertificateRepository) UpdateCertificateLastUsed(certID uuid.UUID) error {
	query := `UPDATE client_certificates SET last_used = $1, updated_at = $2 WHERE id = $3`
	now := time.Now()
	_, err := r.db.Exec(query, now, now, certID)
	return err
}

// RevokeCertificate revokes a certificate
func (r *CertificateRepository) RevokeCertificate(certID uuid.UUID, reason string) error {
	query := `
		UPDATE client_certificates
		SET is_revoked = true, revoked_at = $1, revoked_reason = $2, updated_at = $3
		WHERE id = $4`
	now := time.Now()
	_, err := r.db.Exec(query, now, reason, now, certID)
	return err
}
