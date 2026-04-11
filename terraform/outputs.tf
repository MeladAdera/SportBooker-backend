output "alb_dns_name" {
  description = "ALB DNS name — your API endpoint until you add a custom domain"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for Docker push"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "s3_uploads_bucket" {
  description = "S3 bucket name for venue uploads"
  value       = aws_s3_bucket.uploads.id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}

output "bastion_public_ip" {
  description = "Bastion public IP — use for SSH tunnel"
  value       = aws_instance.bastion.public_ip
}

output "bastion_ssh_command" {
  description = "Ready-to-run SSH tunnel command"
  value       = "ssh -i terraform/bastion.pem -N -L 5432:${aws_db_instance.main.address}:5432 ec2-user@${aws_instance.bastion.public_ip}"
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for ECS"
  value       = aws_cloudwatch_log_group.ecs.name
}
