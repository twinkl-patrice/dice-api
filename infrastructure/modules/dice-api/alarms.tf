# Lambda Errors alarm
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
    for_each = toset([
        module.lambda_roll.lambda_function_name,
        module.lambda_stats.lambda_function_name,
        module.lambda_reset.lambda_function_name,
        module.lambda_authoriser.lambda_function_name,
        module.lambda_stats_processor.lambda_function_name,
        module.lambda_stream_processor.lambda_function_name,
    ])

    alarm_name          = "${each.value}-errors"
    alarm_description   = "Lambda errors for ${each.value}"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = 1
    metric_name         = "Errors"
    namespace           = "AWS/Lambda"
    period              = 300
    statistic           = "Sum"
    threshold           = 0
    treat_missing_data  = "notBreaching"

    dimensions = {
        FunctionName = each.value
    }

    tags = {
        Name = "${each.value}-errors"
    }
}

# API Gateway 5xx alarm
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
    alarm_name          = "${var.service_name}-api-5xx"
    alarm_description   = "API Gateway 5xx errors"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = 1
    metric_name         = "5xx"
    namespace           = "AWS/ApiGateway"
    period              = 300
    statistic           = "Sum"
    threshold           = 0
    treat_missing_data  = "notBreaching"

    dimensions = {
        ApiId = module.api_gateway.api_id
    }

    tags = {
        Name = "${var.service_name}-api-5xx"
    }
}

# SQS Message Age alarm
resource "aws_cloudwatch_metric_alarm" "sqs_message_age" {
    alarm_name          = "${var.service_name}-sqs-message-age"
    alarm_description   = "Stats queue message age exceeds 60 seconds"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = 1
    metric_name         = "ApproximateAgeOfOldestMessage"
    namespace           = "AWS/SQS"
    period              = 60
    statistic           = "Maximum"
    threshold           = 60
    treat_missing_data  = "notBreaching"

    dimensions = {
        QueueName = module.stats_queue.queue_name
    }

    tags = {
        Name = "${var.service_name}-sqs-message-age"
    }
}

# SQS DLQ Depth alarm
resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
    alarm_name          = "${var.service_name}-dlq-depth"
    alarm_description   = "Messages in the stats dead letter queue"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = 1
    metric_name         = "ApproximateNumberOfMessagesVisible"
    namespace           = "AWS/SQS"
    period              = 60
    statistic           = "Sum"
    threshold           = 0
    treat_missing_data  = "notBreaching"

    dimensions = {
        QueueName = module.stats_queue.dead_letter_queue_name
    }

    tags = {
        Name = "${var.service_name}-dlq-depth"
    }
}

# Lambda Duration alarm (approaching timeout)
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
    for_each = {
        roll            = { name = module.lambda_roll.lambda_function_name, threshold = 8000 }
        stats           = { name = module.lambda_stats.lambda_function_name, threshold = 8000 }
        reset           = { name = module.lambda_reset.lambda_function_name, threshold = 25000 }
        stats_processor = { name = module.lambda_stats_processor.lambda_function_name, threshold = 25000 }
    }

    alarm_name          = "${each.value.name}-duration"
    alarm_description   = "Lambda duration approaching timeout for ${each.value.name}"
    comparison_operator = "GreaterThanThreshold"
    evaluation_periods  = 1
    metric_name         = "Duration"
    namespace           = "AWS/Lambda"
    period              = 300
    statistic           = "Maximum"
    threshold           = each.value.threshold
    treat_missing_data  = "notBreaching"

    dimensions = {
        FunctionName = each.value.name
    }

    tags = {
        Name = "${each.value.name}-duration"
    }
}
