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


output "backend_api_url" {
  description = "Backend API URL"
  value       = var.api_domain != "" ? "https://${var.api_domain}/api" : "http://${aws_lb.backend.dns_name}/api"
}

# Certificate validation DNS records - add these to GoDaddy
output "certificate_validation_records" {
  description = "DNS records to add to GoDaddy for certificate validation"
  value = var.api_domain != "" ? {
    for dvo in aws_acm_certificate.backend[0].domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  } : {}
}

output "api_domain_cname" {
  description = "CNAME record to add to GoDaddy pointing your domain to the ALB"
  value = var.api_domain != "" ? {
    name  = var.api_domain
    type  = "CNAME"
    value = aws_lb.backend.dns_name
  } : null
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for backend"
  value       = aws_cloudwatch_log_group.backend.name
}

# Worker outputs
output "worker_ecr_repository_url" {
  description = "URL of the ECR repository for worker"
  value       = aws_ecr_repository.worker.repository_url
}

output "worker_service_name" {
  description = "Name of the worker ECS service"
  value       = aws_ecs_service.worker.name
}

output "worker_log_group" {
  description = "CloudWatch log group for worker"
  value       = aws_cloudwatch_log_group.worker.name
}

# SQS outputs
output "sqs_queue_url" {
  description = "URL of the video processing SQS queue"
  value       = aws_sqs_queue.video_processing.url
}

output "sqs_queue_arn" {
  description = "ARN of the video processing SQS queue"
  value       = aws_sqs_queue.video_processing.arn
}

output "sqs_dlq_url" {
  description = "URL of the dead letter queue"
  value       = aws_sqs_queue.video_processing_dlq.url
}

# Redis outputs
output "redis_endpoint" {
  description = "Redis ElastiCache endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis ElastiCache port"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].port
}
