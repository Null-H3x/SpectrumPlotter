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
		INSERT INTO users (id, username, email, full_name, organization, role, is_active, certificate_serial, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at`

	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		user.ID, user.Username, user.Email, user.FullName,
		user.Organization, user.Role, user.IsActive, user.CertificateSerial,
		user.CreatedAt, user.UpdatedAt,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

// UpdateLastLogin updates user's last login time
func (r *UserRepository) UpdateLastLogin(userID uuid.UUID) error {
	query := `UPDATE users SET last_login = $1, updated_at = $2 WHERE id = $3`
	now := time.Now()
	_, err := r.db.Exec(query, now, now, userID)
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

// SessionRepository handles session operations
type SessionRepository struct {
	db *sqlx.DB
}

func NewSessionRepository(db *sqlx.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

// CreateSession creates a new session
func (r *SessionRepository) CreateSession(session *models.Session) error {
	query := `
		INSERT INTO sessions (id, user_id, token, auth_method, ip_address, user_agent, expires_at, last_activity, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`

	session.ID = uuid.New()
	session.CreatedAt = time.Now()
	session.LastActivity = time.Now()

	return r.db.QueryRow(query,
		session.ID, session.UserID, session.Token, session.AuthMethod,
		session.IPAddress, session.UserAgent, session.ExpiresAt,
		session.LastActivity, session.CreatedAt,
	).Scan(&session.ID, &session.CreatedAt)
}

// GetSessionByToken retrieves a session by token
func (r *SessionRepository) GetSessionByToken(token string) (*models.Session, error) {
	var session models.Session
	query := `SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()`
	err := r.db.Get(&session, query, token)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &session, err
}

// UpdateSessionActivity updates session last activity
func (r *SessionRepository) UpdateSessionActivity(sessionID uuid.UUID) error {
	query := `UPDATE sessions SET last_activity = $1 WHERE id = $2`
	_, err := r.db.Exec(query, time.Now(), sessionID)
	return err
}

// DeleteSession deletes a session (logout)
func (r *SessionRepository) DeleteSession(token string) error {
	query := `DELETE FROM sessions WHERE token = $1`
	_, err := r.db.Exec(query, token)
	return err
}

// CleanupExpiredSessions removes expired sessions
func (r *SessionRepository) CleanupExpiredSessions() error {
	query := `DELETE FROM sessions WHERE expires_at < NOW()`
	_, err := r.db.Exec(query)
	return err
}
