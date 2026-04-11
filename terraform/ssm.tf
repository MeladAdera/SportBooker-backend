locals {
  ssm_prefix = "/${var.project_name}/${var.environment}"
}

resource "aws_ssm_parameter" "db_password" {
  name  = "${local.ssm_prefix}/DB_PASSWORD"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "jwt_access_secret" {
  name  = "${local.ssm_prefix}/JWT_ACCESS_SECRET"
  type  = "SecureString"
  value = var.jwt_access_secret
}

resource "aws_ssm_parameter" "sendgrid_api_key" {
  name  = "${local.ssm_prefix}/SENDGRID_API_KEY"
  type  = "SecureString"
  value = var.sendgrid_api_key != "" ? var.sendgrid_api_key : "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "stripe_secret_key" {
  name  = "${local.ssm_prefix}/STRIPE_SECRET_KEY"
  type  = "SecureString"
  value = var.stripe_secret_key != "" ? var.stripe_secret_key : "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "stripe_webhook_secret" {
  name  = "${local.ssm_prefix}/STRIPE_WEBHOOK_SECRET"
  type  = "SecureString"
  value = var.stripe_webhook_secret != "" ? var.stripe_webhook_secret : "placeholder"

  lifecycle { ignore_changes = [value] }
}
