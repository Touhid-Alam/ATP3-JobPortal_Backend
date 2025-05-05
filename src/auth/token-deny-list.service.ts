import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

// Simple in-memory store. Replace with Redis/DB for production.
interface DeniedTokenInfo {
    jti: string;
    exp: number; // Expiration timestamp (in seconds since epoch)
}

@Injectable()
export class TokenDenyListService implements OnModuleInit {
    private readonly logger = new Logger(TokenDenyListService.name);
    // Use a Set for efficient checking (O(1) average time complexity)
    private deniedTokenStore = new Map<string, DeniedTokenInfo>(); // Store jti -> {jti, exp}
    private cleanupInterval: NodeJS.Timeout | null = null;

    onModuleInit() {
        // Start periodic cleanup when the module initializes
        this.scheduleCleanup();
        this.logger.log('Token Deny List Service initialized.');
    }

    /**
     * Adds a token's JTI to the deny list with its expiration time.
     * @param jti The JWT ID (unique identifier) of the token.
     * @param exp The expiration timestamp (in seconds since epoch) of the token.
     */
    denyToken(jti: string, exp: number): void {
        if (!jti || !exp) {
            this.logger.warn('Attempted to deny token with invalid JTI or EXP.');
            return;
        }
        // Store the info. If already present, it will be overwritten (which is fine).
        this.deniedTokenStore.set(jti, { jti, exp });
        this.logger.log(`Token JTI ${jti} added to deny list. Expires at ${new Date(exp * 1000).toISOString()}`);
    }

    /**
     * Checks if a token's JTI is currently on the deny list.
     * @param jti The JWT ID to check.
     * @returns True if the token is denied, false otherwise.
     */
    isTokenDenied(jti: string): boolean {
        if (!jti) return false;

        const deniedInfo = this.deniedTokenStore.get(jti);
        if (!deniedInfo) {
            return false; // Not on the list
        }

        // Optional: Check if the entry itself has expired based on stored exp
        // This helps cleanup but isn't strictly necessary for the check itself
        // as JwtStrategy already checks the token's main expiry.
        // const nowInSeconds = Math.floor(Date.now() / 1000);
        // if (deniedInfo.exp < nowInSeconds) {
        //     this.deniedTokenStore.delete(jti); // Clean up expired entry during check
        //     return false; // Treat as not denied because it's expired anyway
        // }

        return true; // It's on the list and hasn't been cleaned up yet
    }

    /**
     * Periodically removes expired tokens from the in-memory store.
     */
    private cleanupExpiredTokens(): void {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        let removedCount = 0;
        this.deniedTokenStore.forEach((info, jti) => {
            if (info.exp < nowInSeconds) {
                this.deniedTokenStore.delete(jti);
                removedCount++;
            }
        });
        if (removedCount > 0) {
            this.logger.log(`Cleaned up ${removedCount} expired denied tokens.`);
        }
    }

    /**
     * Schedules the periodic cleanup task.
     */
    private scheduleCleanup(): void {
        // Clear existing interval if any
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Run cleanup every hour (adjust interval as needed)
        const cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredTokens();
        }, cleanupIntervalMs);
        this.logger.log(`Scheduled denied token cleanup every ${cleanupIntervalMs / 1000 / 60} minutes.`);
    }

    // Ensure interval is cleared on module destruction
    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.logger.log('Cleared denied token cleanup interval.');
        }
    }
}