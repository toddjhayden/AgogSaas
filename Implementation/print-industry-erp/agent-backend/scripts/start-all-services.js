"use strict";
/**
 * Start All Services
 * Launches proactive daemons with proper environment configuration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
// Set environment variables for local development
// Load from .env file or use defaults
// IMPORTANT: Set NATS_PASSWORD environment variable before running
if (!process.env.NATS_URL)
    process.env.NATS_URL = 'nats://localhost:4223';
if (!process.env.NATS_USER)
    process.env.NATS_USER = 'agents';
if (!process.env.OWNER_REQUESTS_PATH) {
    process.env.OWNER_REQUESTS_PATH = 'D:/GitHub/agogsaas/project-spirit/owner_requests/OWNER_REQUESTS.md';
}
// Import and run the main daemon starter
Promise.resolve().then(() => __importStar(require('./start-proactive-daemons')));
