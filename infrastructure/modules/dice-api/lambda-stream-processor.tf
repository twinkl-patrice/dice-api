module "lambda_stream_processor" {
    source  = "terraform-aws-modules/lambda/aws"
    version = "~> 7.0"

    function_name = "${var.service_name}-stream-processor"
    description   = "Dice API - Process DynamoDB Stream events and publish to SNS"
    handler       = "stream-processor.handler"
    runtime       = "nodejs24.x"
    architectures = ["arm64"]
    timeout       = 30

    create_package         = false
    local_existing_package = "${var.dist_path}/processors/stream-processor.zip"
    publish                = true

    environment_variables = {
        TOPIC_ARN               = module.sns_topic.topic_arn
        POWERTOOLS_SERVICE_NAME = var.service_name
        LOG_LEVEL               = "INFO"
    }

    attach_policy_statements = true
    policy_statements = {
        dynamodb_stream = {
            effect = "Allow"
            actions = [
                "dynamodb:GetRecords",
                "dynamodb:GetShardIterator",
                "dynamodb:DescribeStream",
                "dynamodb:ListStreams",
            ]
            resources = [aws_dynamodb_table.rolls.stream_arn]
        }
        sns = {
            effect    = "Allow"
            actions   = ["sns:Publish"]
            resources = [module.sns_topic.topic_arn]
        }
        sqs_dlq = {
            effect    = "Allow"
            actions   = ["sqs:SendMessage"]
            resources = [module.stream_dlq.queue_arn]
        }
    }

    event_source_mapping = {
        dynamodb = {
            event_source_arn           = aws_dynamodb_table.rolls.stream_arn
            starting_position          = "LATEST"
            batch_size                 = 10
            enabled                    = var.enable_stream_processor
            maximum_retry_attempts     = 3
            maximum_record_age_in_seconds = 120
            bisect_batch_on_function_error = true

            filter_criteria = {
                pattern = jsonencode({
                    eventName = ["INSERT"]
                })
            }

            destination_config = {
                on_failure = {
                    destination_arn = module.stream_dlq.queue_arn
                }
            }
        }
    }

    tags = {
        Name = "${var.service_name}-stream-processor"
    }
}
