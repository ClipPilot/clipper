# Outputs

output "ecr_repository_url" {
  description = "URL of the ECR repository for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.backend.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.backend.zone_id
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for videos"
  value       = aws_s3_bucket.videos.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for videos"
  value       = aws_s3_bucket.videos.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.backend.name
}

output "amplify_app_id" {
  description = "ID of the Amplify app"
  value       = aws_amplify_app.frontend.id
}

output "amplify_default_domain" {
  description = "Default domain of the Amplify app"
  value       = aws_amplify_app.frontend.default_domain
}

output "amplify_app_url" {
  description = "URL of the Amplify app"
  value       = "https://${var.amplify_branch}.${aws_amplify_app.frontend.default_domain}"
}

output "backend_api_url" {
  description = "Backend API URL (HTTP - add HTTPS later with custom domain)"
  value       = "http://${aws_lb.backend.dns_name}/api"
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for backend"
  value       = aws_cloudwatch_log_group.backend.name
}
# Trigger deployment
