class DataRateMonitor {
  constructor(intervalMs = 1000) {
    this.bytesReceived = 0;
    this.bytesSent = 0;
    this.lastReceivedTimestamp = Date.now();
    this.lastSentTimestamp = Date.now();
    this.receiveRate = 0.0;  // Mbps
    this.sendRate = 0.0;
    this.updateInterval = intervalMs;
    this.isRunning = false;
    this.intervalId = null;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => this.calculateRates(), this.updateInterval);
  }

  stop() {
    if (!this.isRunning) return;
    
    clearInterval(this.intervalId);
    this.isRunning = false;
  }

  recordReceived(bytes) {
    const now = Date.now();
    this.bytesReceived += bytes;
    this.lastReceivedTimestamp = now;
  }

  recordSent(bytes) {
    const now = Date.now();
    this.bytesSent += bytes;
    this.lastSentTimestamp = now;
  }

  calculateRates() {
    const now = Date.now();
    
    const receiveElapsedSec = (now - this.lastReceivedTimestamp) / 1000;  // elapsed time is in millisecs
    if (receiveElapsedSec > 0) {
      this.receiveRate = ((this.bytesReceived * 8) / 1000000) / receiveElapsedSec;  // bytes * 8 to get bits, then divide by a million to get it as Mb, and then divide by elapsed time in seconds to get Mb/s
    }
    
    const sendElapsedSec = (now - this.lastSentTimestamp) / 1000;
    if (sendElapsedSec > 0) {
      this.sendRate = ((this.bytesSent * 8) / 1000000) / sendElapsedSec;
    }
    
    this.bytesReceived = 0.0;
    this.bytesSent = 0.0;
    this.lastReceivedTimestamp = now;
    this.lastSentTimestamp = now;
    
    return {
      receiveRate: this.receiveRate,
      sendRate: this.sendRate
    };
  }

  getCurrentRates() {
    return {
      receiveRate: this.receiveRate,
      sendRate: this.sendRate
    };
  }
}

module.exports = DataRateMonitor;