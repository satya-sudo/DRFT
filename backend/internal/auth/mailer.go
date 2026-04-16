package auth

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"drft/internal/config"
)

type Mailer interface {
	SendPasswordResetCode(ctx context.Context, toEmail, toName, code string, expiresAt time.Time) error
}

type NoopMailer struct{}

func (NoopMailer) SendPasswordResetCode(context.Context, string, string, string, time.Time) error {
	return fmt.Errorf("email password reset is not configured")
}

type SMTPMailer struct {
	host     string
	port     string
	username string
	password string
	from     string
	fromName string
}

func NewMailer(cfg config.Config) Mailer {
	if cfg.SMTPHost == "" || cfg.SMTPPort == "" || cfg.SMTPUsername == "" || cfg.SMTPPassword == "" || cfg.SMTPFromEmail == "" {
		return NoopMailer{}
	}

	return SMTPMailer{
		host:     cfg.SMTPHost,
		port:     cfg.SMTPPort,
		username: cfg.SMTPUsername,
		password: cfg.SMTPPassword,
		from:     cfg.SMTPFromEmail,
		fromName: cfg.SMTPFromName,
	}
}

func (m SMTPMailer) SendPasswordResetCode(_ context.Context, toEmail, toName, code string, expiresAt time.Time) error {
	subject := "Your DRFT password reset code"
	recipientName := strings.TrimSpace(toName)
	if recipientName == "" {
		recipientName = "there"
	}

	body := fmt.Sprintf("Hello %s,\n\nYour DRFT password reset code is: %s\n\nThis code expires at %s.\nIf you did not request this, you can ignore this email.\n", recipientName, code, expiresAt.Format(time.RFC1123))

	message := strings.Join([]string{
		fmt.Sprintf("From: %s", formatAddress(m.fromName, m.from)),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	address := fmt.Sprintf("%s:%s", m.host, m.port)
	auth := smtp.PlainAuth("", m.username, m.password, m.host)

	client, err := smtp.Dial(address)
	if err != nil {
		return fmt.Errorf("connect smtp server: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: m.host}); err != nil {
			return fmt.Errorf("start tls: %w", err)
		}
	}

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("authenticate smtp client: %w", err)
	}
	if err := client.Mail(m.from); err != nil {
		return fmt.Errorf("set sender: %w", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("set recipient: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("open smtp message: %w", err)
	}
	if _, err := writer.Write([]byte(message)); err != nil {
		writer.Close()
		return fmt.Errorf("write smtp message: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close smtp writer: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("finish smtp session: %w", err)
	}

	return nil
}

func formatAddress(name, email string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return email
	}

	return fmt.Sprintf("%s <%s>", name, email)
}
