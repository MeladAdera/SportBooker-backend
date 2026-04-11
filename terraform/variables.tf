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

variable "app_domain" {
  description = "Application domain for tenant subdomain resolution"
  type        = string
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

variable "sendgrid_api_key" {
  description = "SendGrid API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from" {
  description = "Sender email address for transactional emails"
  type        = string
  default     = ""
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

# ── GitHub OIDC ──────────────────────────────────────────────────────

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
}

variable "github_branch" {
  description = "Branch that can deploy (for OIDC trust policy)"
  type        = string
  default     = "main"
}
