# SQS Queue for Video Processing Jobs
# This queue handles all async video processing tasks

# Dead Letter Queue for failed messages
resource "aws_sqs_queue" "video_processing_dlq" {
  name                      = "${var.project_name}-video-processing-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-video-processing-dlq-${var.environment}"
  }
}

# Main Video Processing Queue
resource "aws_sqs_queue" "video_processing" {
  name                       = "${var.project_name}-video-processing-${var.environment}"
  visibility_timeout_seconds = 900   # 15 minutes - should be longer than max processing time
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 20    # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.video_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-video-processing-${var.environment}"
  }
}

# CloudWatch Alarm for DLQ messages (alerts when jobs are failing)
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${var.project_name}-dlq-messages-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when messages appear in the Dead Letter Queue"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.video_processing_dlq.name
  }

  tags = {
    Name = "${var.project_name}-dlq-alarm-${var.environment}"
  }
}

