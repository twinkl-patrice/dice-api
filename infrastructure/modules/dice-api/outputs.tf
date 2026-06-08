output "api_endpoint" {
    description = "API Gateway endpoint URL"
    value       = module.api_gateway.api_endpoint
}

output "api_key_secret_name" {
    description = "Secrets Manager secret name for the API key"
    value       = aws_secretsmanager_secret.api_key.name
}

output "api_key_value" {
    description = "The generated API key value"
    value       = random_password.api_key.result
    sensitive   = true
}

output "dynamodb_table_name" {
    description = "DynamoDB table name"
    value       = aws_dynamodb_table.rolls.name
}

output "sqs_queue_url" {
    description = "Stats SQS queue URL"
    value       = module.stats_queue.queue_url
}

output "sns_topic_arn" {
    description = "Roll events SNS topic ARN"
    value       = module.sns_topic.topic_arn
}
