/**
 * IP Address Helpers
 * Utilities for IP address manipulation and validation
 */

/**
 * Validate IP address format
 * @param ip IP address string
 * @returns true if valid, false otherwise
 */
export function isValidIP(ip: string): boolean {
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipRegex);

  if (!match) {
    return false;
  }

  return match.slice(1).every(octet => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Get network address from IP and subnet mask
 * @param ip IP address
 * @param subnetMask Subnet mask
 * @returns Network address
 */
export function getNetworkAddress(ip: string, subnetMask: string): string {
  const ipParts = ip.split('.').map(Number);
  const maskParts = subnetMask.split('.').map(Number);

  const networkParts = ipParts.map((part, i) => part & maskParts[i]);
  return networkParts.join('.');
}

/**
 * Check if IP is in the same network
 * @param ip1 First IP
 * @param ip2 Second IP
 * @param subnetMask Subnet mask
 * @returns true if same network, false otherwise
 */
export function areSameNetwork(ip1: string, ip2: string, subnetMask: string): boolean {
  return getNetworkAddress(ip1, subnetMask) === getNetworkAddress(ip2, subnetMask);
}

/**
 * Find next available IP from a list of devices
 * @param devices Array of network devices
 * @param settings Global network settings
 * @returns Next available IP address
 */
export function findNextAvailableIP(
  devices: Array<{ ip: string }>,
  settings: { ipClass: string }
): string {
  const usedIPs = new Set(devices.map(dev => dev.ip));
  const baseIP = settings.ipClass.substring(
    0,
    settings.ipClass.lastIndexOf('.') + 1
  );

  for (let i = 2; i < 255; i++) {
    const ip = `${baseIP}${i}`;
    if (!usedIPs.has(ip)) {
      return ip;
    }
  }

  return `${baseIP}254`; // Fallback
}

/**
 * Generate random MAC address
 * Format: XX:XX:XX:XX:XX:XX (locally administered, unicast)
 * First octet starts with 02 to indicate locally administered address
 * @returns Random MAC address string
 */
export function generateMacAddress(): string {
  const octets: string[] = ['02']; // Locally administered, unicast

  // Generate 5 random octets
  for (let i = 0; i < 5; i++) {
    const randomByte = Math.floor(Math.random() * 256);
    const hex = randomByte.toString(16).padStart(2, '0').toUpperCase();
    octets.push(hex);
  }

  return octets.join(':');
}

/**
 * Validate MAC address format
 * @param mac MAC address string
 * @returns true if valid, false otherwise
 */
export function isValidMAC(mac: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
  return macRegex.test(mac);
}
