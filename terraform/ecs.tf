# ── ECS Cluster ──────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

# ── Task Definition ──────────────────────────────────────────────────

resource "aws_ecs_task_definition" "app" {
  family                   = var.project_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name      = var.project_name
    image     = "${aws_ecr_repository.app.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "PORT", value = "3000" },
      { name = "NODE_ENV", value = "production" },
      { name = "TENANT_HOST_SUFFIX", value = var.TENANT_HOST_SUFFIX },
      { name = "DB_HOST", value = split(":", aws_db_instance.main.endpoint)[0] },
      { name = "DB_PORT", value = "5432" },
      { name = "DB_SSL", value = "true" },
      { name = "DB_NAME", value = var.db_name },
      { name = "DB_USER", value = var.db_username },
      { name = "JWT_ACCESS_EXPIRES_IN", value = var.jwt_access_expires_in },
      { name = "EMAIL_FROM", value = var.email_from },
      { name = "EMAIL_APP_NAME", value = var.email_app_name },
      { name = "EMAIL_SUPPORT_EMAIL", value = var.email_support_email != "" ? var.email_support_email : var.email_from },
      { name = "EMAIL_WAITLIST_REFUND_ETA", value = var.email_waitlist_refund_eta },
      { name = "S3_BUCKET_NAME", value = aws_s3_bucket.uploads.id },
      { name = "S3_REGION", value = var.aws_region },
      { name = "API_PUBLIC_ORIGIN", value = "https://api.${var.TENANT_HOST_SUFFIX}" },
      { name = "WEB_APP_PUBLIC_ORIGIN", value = "https://app.${var.TENANT_HOST_SUFFIX}" },
      { name = "CORS_ORIGINS", value = var.cors_origins },
    ]

    secrets = [
      { name = "DB_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
      { name = "JWT_ACCESS_SECRET", valueFrom = aws_ssm_parameter.jwt_access_secret.arn },
      { name = "RESEND_API_KEY", valueFrom = aws_ssm_parameter.resend_api_key.arn },
      { name = "RESEND_TEMPLATE_PASSWORD_RESET_ID", valueFrom = aws_ssm_parameter.resend_template_password_reset_id.arn },
      { name = "RESEND_TEMPLATE_EMAIL_VERIFICATION_ID", valueFrom = aws_ssm_parameter.resend_template_email_verification_id.arn },
      { name = "RESEND_TEMPLATE_WAITLIST_EXPIRED_REFUND_ID", valueFrom = aws_ssm_parameter.resend_template_waitlist_expired_refund_id.arn },
      { name = "STRIPE_SECRET_KEY", valueFrom = aws_ssm_parameter.stripe_secret_key.arn },
      { name = "STRIPE_WEBHOOK_SECRET", valueFrom = aws_ssm_parameter.stripe_webhook_secret.arn },
      { name = "OPENAPI_DOCS_TOKEN", valueFrom = aws_ssm_parameter.openapi_docs_token.arn },
      { name = "ZIINA_ENCRYPTION_KEY", valueFrom = aws_ssm_parameter.ziina_encryption_key.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# ── ECS Service ──────────────────────────────────────────────────────

resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.project_name
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes = [task_definition]
  }
}
