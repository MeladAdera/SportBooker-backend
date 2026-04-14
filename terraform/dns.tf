# ── ACM Certificate (apex + wildcard) ────────────────────────────────
#
# DNS is managed by Vercel DNS (nameservers: ns1/ns2.vercel-dns.com).
# The ACM validation CNAME and all other records (api, apex, wildcard)
# live in Vercel DNS — not Route 53.
#
# ACM auto-renews as long as the validation CNAME exists in the
# authoritative DNS provider, regardless of whether that's Route 53.

resource "aws_acm_certificate" "main" {
  domain_name               = var.TENANT_HOST_SUFFIX
  subject_alternative_names = ["*.${var.TENANT_HOST_SUFFIX}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-cert" }
}
