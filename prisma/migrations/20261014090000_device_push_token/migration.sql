-- Child devices send an FCM token on /sync so changes can wake them (child-app-spec G1)
ALTER TABLE "Device" ADD COLUMN "pushToken" TEXT;
