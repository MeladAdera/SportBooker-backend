variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "sportbooker"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# ── ECS ──────────────────────────────────────────────────────────────

variable "container_cpu" {
  description = "CPU units for ECS task (256 = 0.25 vCPU)"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Memory for ECS task in MiB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

# ── RDS ──────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "sportbooker"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "sportbooker"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

# ── Application Config ───────────────────────────────────────────────

variable "TENANT_HOST_SUFFIX" {
  description = "Application domain for tenant subdomain resolution"
  type        = string
}

variable "cors_origins" {
  description = "Comma-separated browser origins for Access-Control-Allow-Origin (e.g. Vercel frontend)"
  type        = string
  default     = "https://sport-booker-fe.vercel.app"
}

variable "jwt_access_secret" {
  description = "JWT access token secret (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "jwt_access_expires_in" {
  description = "JWT access token expiry"
  type        = string
  default     = "15m"
}

variable "resend_api_key" {
  description = "Resend API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from" {
  description = "Sender email address for transactional emails"
  type        = string
  default     = ""
}

variable "email_app_name" {
  description = "Brand name used in transactional email templates"
  type        = string
  default     = "SportBooker"
}

variable "email_support_email" {
  description = "Support email shown in transactional email templates"
  type        = string
  default     = ""
}

variable "email_waitlist_refund_eta" {
  description = "Human-readable ETA text shown in waitlist refund emails"
  type        = string
  default     = "3-5 business days"
}

variable "resend_template_password_reset_id" {
  description = "Resend template ID for password reset emails"
  type        = string
  default     = ""
  sensitive   = true
}

variable "resend_template_email_verification_id" {
  description = "Resend template ID for email verification emails"
  type        = string
  default     = ""
  sensitive   = true
}

variable "resend_template_waitlist_expired_refund_id" {
  description = "Resend template ID for waitlist expired refund emails"
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe secret key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ziina_encryption_key" {
  description = "AES-256-GCM key for encrypting Ziina tokens at rest (64 hex chars). Generate: openssl rand -hex 32"
  type        = string
  default     = ""
  sensitive   = true
}

# ── GitHub OIDC ──────────────────────────────────────────────────────

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
}

variable "bastion_allowed_cidr" {
  description = "Your public IP in CIDR notation (e.g. 1.2.3.4/32). Only this IP can SSH to the bastion."
  type        = string
}

variable "github_branch" {
  description = "Branch that can deploy (for OIDC trust policy)"
  type        = string
  default     = "main"
}
