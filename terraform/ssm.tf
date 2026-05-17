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

resource "aws_ssm_parameter" "resend_api_key" {
  name  = "${local.ssm_prefix}/RESEND_API_KEY"
  type  = "SecureString"
  value = var.resend_api_key != "" ? var.resend_api_key : "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "resend_template_password_reset_id" {
  name  = "${local.ssm_prefix}/RESEND_TEMPLATE_PASSWORD_RESET_ID"
  type  = "SecureString"
  value = var.resend_template_password_reset_id != "" ? var.resend_template_password_reset_id : "placeholder"
}

resource "aws_ssm_parameter" "resend_template_email_verification_id" {
  name  = "${local.ssm_prefix}/RESEND_TEMPLATE_EMAIL_VERIFICATION_ID"
  type  = "SecureString"
  value = var.resend_template_email_verification_id != "" ? var.resend_template_email_verification_id : "placeholder"
}

resource "aws_ssm_parameter" "resend_template_waitlist_expired_refund_id" {
  name  = "${local.ssm_prefix}/RESEND_TEMPLATE_WAITLIST_EXPIRED_REFUND_ID"
  type  = "SecureString"
  value = var.resend_template_waitlist_expired_refund_id != "" ? var.resend_template_waitlist_expired_refund_id : "placeholder"
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

resource "random_password" "openapi_docs_token" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "openapi_docs_token" {
  name  = "${local.ssm_prefix}/OPENAPI_DOCS_TOKEN"
  type  = "SecureString"
  value = random_password.openapi_docs_token.result
}

resource "aws_ssm_parameter" "ziina_encryption_key" {
  name  = "${local.ssm_prefix}/ZIINA_ENCRYPTION_KEY"
  type  = "SecureString"
  value = var.ziina_encryption_key != "" ? var.ziina_encryption_key : "placeholder"

  lifecycle { ignore_changes = [value] }
}
