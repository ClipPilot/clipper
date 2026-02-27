# Lambda function to sync virality targets via Apify
# Runs every 12 hours via EventBridge -> Step Functions

# ECR Repository for Virality Sync Lambda
# Note: Prod uses 'clipster-virality-sync-lambda', staging uses 'clipster-virality-sync-lambda-staging'
# This separation prevents staging deployments from triggering ECR lifecycle policy
# that could delete production images
resource "aws_ecr_repository" "virality_sync_lambda" {
  name                 = var.environment == "prod" ? "${var.project_name}-virality-sync-lambda" : "${var.project_name}-virality-sync-lambda-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = var.environment == "prod" ? "${var.project_name}-virality-sync-lambda" : "${var.project_name}-virality-sync-lambda-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecr_lifecycle_policy" "virality_sync_lambda" {
  repository = aws_ecr_repository.virality_sync_lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# IAM Role for Virality Sync Lambda
resource "aws_iam_role" "virality_sync_lambda" {
  name = "${var.project_name}-virality-sync-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-virality-sync-lambda-role-${var.environment}"
    Environment = var.environment
  }
}

# Lambda basic execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "virality_sync_lambda_basic" {
  role       = aws_iam_role.virality_sync_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Orchestrator Lambda — lightweight, fetches accounts only
resource "aws_lambda_function" "virality_sync_orchestrator" {
  function_name = "${var.project_name}-virality-sync-orchestrator-${var.environment}"
  role          = aws_iam_role.virality_sync_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.virality_sync_lambda.repository_url}:latest"
  timeout       = 60
  memory_size   = 256

  image_config {
    command = ["lambda-virality-sync/dist/handler.orchestratorHandler"]
  }

  environment {
    variables = {
      DATABASE_URL = var.database_url
    }
  }

  depends_on = [aws_iam_role_policy_attachment.virality_sync_lambda_basic]
  lifecycle { ignore_changes = [image_uri] }

  tags = {
    Name        = "${var.project_name}-virality-sync-orchestrator-${var.environment}"
    Environment = var.environment
  }
}

# Worker Lambda — handles single account sync
resource "aws_lambda_function" "virality_sync_worker" {
  function_name = "${var.project_name}-virality-sync-worker-${var.environment}"
  role          = aws_iam_role.virality_sync_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.virality_sync_lambda.repository_url}:latest"
  timeout       = 900
  memory_size   = 512

  image_config {
    command = ["lambda-virality-sync/dist/handler.workerHandler"]
  }

  environment {
    variables = {
      DATABASE_URL       = var.database_url
      APIFY_API_TOKEN    = var.apify_api_token
      SOCIALDATA_API_KEY = var.socialdata_api_key
    }
  }

  depends_on = [aws_iam_role_policy_attachment.virality_sync_lambda_basic]
  lifecycle { ignore_changes = [image_uri] }

  tags = {
    Name        = "${var.project_name}-virality-sync-worker-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "virality_sync_orchestrator" {
  name              = "/aws/lambda/${var.project_name}-virality-sync-orchestrator-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-virality-sync-orchestrator-logs-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "virality_sync_worker" {
  name              = "/aws/lambda/${var.project_name}-virality-sync-worker-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-virality-sync-worker-logs-${var.environment}"
    Environment = var.environment
  }
}

# EventBridge Rule - Run every 12 hours
resource "aws_cloudwatch_event_rule" "virality_sync_schedule" {
  name                = "${var.project_name}-virality-sync-schedule-${var.environment}"
  description         = "Trigger virality-sync Step Function every 12 hours"
  schedule_expression = "cron(0 */12 * * ? *)"

  tags = {
    Name        = "${var.project_name}-virality-sync-schedule-${var.environment}"
    Environment = var.environment
  }
}

# ── Step Functions ──

# Step Functions IAM Role
resource "aws_iam_role" "virality_sync_sfn" {
  name = "${var.project_name}-virality-sync-sfn-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
    }]
  })
  tags = {
    Name        = "${var.project_name}-virality-sync-sfn-role-${var.environment}"
    Environment = var.environment
  }
}

# Allow Step Functions to invoke both Lambdas
resource "aws_iam_role_policy" "virality_sync_sfn_invoke_lambda" {
  name = "${var.project_name}-virality-sync-sfn-lambda-${var.environment}"
  role = aws_iam_role.virality_sync_sfn.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = [
        aws_lambda_function.virality_sync_orchestrator.arn,
        aws_lambda_function.virality_sync_worker.arn,
      ]
    }]
  })
}

# CloudWatch Log Group for Step Functions execution logs
resource "aws_cloudwatch_log_group" "virality_sync_sfn" {
  name              = "/aws/states/${var.project_name}-virality-sync-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-virality-sync-sfn-logs-${var.environment}"
    Environment = var.environment
  }
}

# Allow Step Functions to write execution logs
resource "aws_iam_role_policy" "virality_sync_sfn_logs" {
  name = "${var.project_name}-virality-sync-sfn-logs-${var.environment}"
  role = aws_iam_role.virality_sync_sfn.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogDelivery",
        "logs:CreateLogStream",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutLogEvents",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups",
      ]
      Resource = "*"
    }]
  })
}

# State Machine
resource "aws_sfn_state_machine" "virality_sync" {
  name     = "${var.project_name}-virality-sync-${var.environment}"
  role_arn = aws_iam_role.virality_sync_sfn.arn

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.virality_sync_sfn.arn}:*"
    include_execution_data = true
    level                  = "ERROR"
  }

  definition = jsonencode({
    Comment = "Virality Sync - parallel fan-out per account"
    StartAt = "FetchAccounts"
    States = {
      FetchAccounts = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.virality_sync_orchestrator.arn
          Payload      = { source = "step-functions" }
        }
        ResultSelector = { "accounts.$" = "$.Payload.accounts" }
        ResultPath     = "$.orchestratorResult"
        Next           = "SyncAllAccounts"
      }
      SyncAllAccounts = {
        Type           = "Map"
        ItemsPath      = "$.orchestratorResult.accounts"
        MaxConcurrency = var.virality_sync_max_concurrency
        Iterator = {
          StartAt = "SyncOneAccount"
          States = {
            SyncOneAccount = {
              Type     = "Task"
              Resource = "arn:aws:states:::lambda:invoke"
              Parameters = {
                FunctionName = aws_lambda_function.virality_sync_worker.arn
                "Payload.$"  = "$"
              }
              ResultSelector = { "result.$" = "$.Payload" }
              Retry = [{
                ErrorEquals     = ["States.TaskFailed", "Lambda.ServiceException"]
                IntervalSeconds = 30
                MaxAttempts     = 1
                BackoffRate     = 2
              }]
              Catch = [{
                ErrorEquals = ["States.ALL"]
                ResultPath  = "$.error"
                Next        = "AccountSyncFailed"
              }]
              End = true
            }
            AccountSyncFailed = {
              Type   = "Pass"
              Result = { status = "failed" }
              End    = true
            }
          }
        }
        ResultPath = "$.mapResults"
        Next       = "Done"
      }
      Done = { Type = "Succeed" }
    }
  })
  tags = {
    Name        = "${var.project_name}-virality-sync-${var.environment}"
    Environment = var.environment
  }
}

# ── EventBridge -> Step Functions ──

# EventBridge IAM role to start Step Function executions
resource "aws_iam_role" "virality_sync_eventbridge" {
  name = "${var.project_name}-virality-sync-eb-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })
  tags = {
    Name        = "${var.project_name}-virality-sync-eb-role-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "virality_sync_eventbridge_sfn" {
  name = "${var.project_name}-virality-sync-eb-sfn-${var.environment}"
  role = aws_iam_role.virality_sync_eventbridge.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "states:StartExecution"
      Resource = aws_sfn_state_machine.virality_sync.arn
    }]
  })
}

# EventBridge Target - Connect rule to Step Function
resource "aws_cloudwatch_event_target" "virality_sync_target" {
  rule      = aws_cloudwatch_event_rule.virality_sync_schedule.name
  target_id = "virality-sync-sfn"
  arn       = aws_sfn_state_machine.virality_sync.arn
  role_arn  = aws_iam_role.virality_sync_eventbridge.arn
}
