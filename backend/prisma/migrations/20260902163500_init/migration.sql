CREATE TABLE `production_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(191) NOT NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `completed_quantity` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED') NOT NULL DEFAULT 'PENDING',
    `start_date` DATE NOT NULL,
    `deadline` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `production_orders_order_no_key`(`order_no`),
    INDEX `production_orders_status_idx`(`status`),
    INDEX `production_orders_deadline_idx`(`deadline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `equipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipment_no` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('RUNNING', 'STOPPED', 'FAULT', 'MAINTENANCE') NOT NULL DEFAULT 'STOPPED',
    `production_line` VARCHAR(191) NOT NULL,
    `runtime_hours` DOUBLE NOT NULL DEFAULT 0,
    `utilization_rate` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `equipment_equipment_no_key`(`equipment_no`),
    INDEX `equipment_status_idx`(`status`),
    INDEX `equipment_production_line_idx`(`production_line`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_no` VARCHAR(191) NOT NULL,
    `material_name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `safety_stock` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `inventory_material_no_key`(`material_no`),
    INDEX `inventory_quantity_idx`(`quantity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `alerts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipment_id` INTEGER NULL,
    `alert_type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `level` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `status` ENUM('OPEN', 'PROCESSING', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `alerts_status_created_at_idx`(`status`, `created_at`),
    INDEX `alerts_level_created_at_idx`(`level`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `production_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `planned_quantity` INTEGER NOT NULL,
    `actual_quantity` INTEGER NOT NULL,
    INDEX `production_records_date_idx`(`date`),
    UNIQUE INDEX `production_records_order_id_date_key`(`order_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `alerts` ADD CONSTRAINT `alerts_equipment_id_fkey` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `production_records` ADD CONSTRAINT `production_records_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
