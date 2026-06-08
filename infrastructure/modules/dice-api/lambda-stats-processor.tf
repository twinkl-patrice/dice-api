module "lambda_stats_processor" {
    source  = "terraform-aws-modules/lambda/aws"
    version = "~> 7.0"

    function_name = "${var.service_name}-stats-processor"
    description   = "Dice API - Process roll events and update stats"
    handler       = "stats-processor.handler"
    runtime       = "nodejs24.x"
    architectures = ["arm64"]
    timeout       = 30

    create_package         = false
    local_existing_package = "${var.dist_path}/processors/stats-processor.zip"
    publish                = true

    environment_variables = {
        TABLE_NAME              = aws_dynamodb_table.rolls.name
        POWERTOOLS_SERVICE_NAME = var.service_name
        LOG_LEVEL               = "INFO"
    }

    attach_policy_statements = true
    policy_statements = {
        dynamodb = {
            effect = "Allow"
            actions = [
                "dynamodb:UpdateItem",
                "dynamodb:GetItem",
            ]
            resources = [aws_dynamodb_table.rolls.arn]
        }
        sqs = {
            effect = "Allow"
            actions = [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
            ]
            resources = [module.stats_queue.queue_arn]
        }
    }

    event_source_mapping = {
        sqs = {
            event_source_arn = module.stats_queue.queue_arn
            batch_size       = 10
        }
    }

    tags = {
        Name = "${var.service_name}-stats-processor"
    }
}
