CREATE TABLE `agent_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tool_name` VARCHAR(191) NOT NULL,
    `action_type` ENUM('QUERY', 'MUTATION', 'RAG') NOT NULL,
    `arguments` JSON NOT NULL,
    `result` JSON NULL,
    `status` ENUM('SUCCESS', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
    `username` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `agent_actions_created_at_idx`(`created_at`),
    INDEX `agent_actions_action_type_status_idx`(`action_type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
