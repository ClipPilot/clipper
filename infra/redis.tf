# ElastiCache Redis for Socket.io adapter
# Enables real-time WebSocket events across multiple backend instances

# Subnet group for Redis
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-redis-subnet-${var.environment}"
  }
}

# Security group for Redis
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg-${var.environment}"
  description = "Security group for Redis ElastiCache"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-redis-sg-${var.environment}"
  }
}

# ElastiCache Redis cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-redis-${var.environment}"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.environment == "prod" ? "cache.t3.small" : "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Maintenance window (Sunday 3-4 AM UTC)
  maintenance_window = "sun:03:00-sun:04:00"

  # Snapshot settings (for prod)
  snapshot_retention_limit = var.environment == "prod" ? 3 : 0
  snapshot_window          = var.environment == "prod" ? "02:00-03:00" : null

  tags = {
    Name = "${var.project_name}-redis-${var.environment}"
  }
}
