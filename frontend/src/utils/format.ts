/**
 * Format address: display in short form
 */
export const formatAddress = (address: string | null | undefined, length: number = 4): string => {
  if (!address) return '';
  if (address.length <= length * 2 + 2) return address;
  if (!address.startsWith('0x')) return address;
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
};

/**
 * Format amount: SUI format
 * Convert mist (smallest unit) to SUI display
 * 1 SUI = 1,000,000,000 mist
 * 
 * @param amount - Amount (can be mist or SUI)
 * @param decimals - Decimal places
 * @param isMist - If true, force mist processing (needs conversion)
 * @returns Formatted string (without "SUI" unit)
 */
export const formatSUI = (amount: number | string, decimals: number = 4, isMist: boolean = true): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.0000';
  
  if (isMist && num >= 1) {
    const suiAmount = num / 1e9;
    return suiAmount.toFixed(decimals);
  }
  
  return num.toFixed(decimals);
};

/**
 * Format time: relative time
 * Supports timestamp (seconds or milliseconds) and date strings
 */
export const formatTime = (timestamp: string | number | undefined | null): string => {
  if (!timestamp) return 'Unknown';
  
  let date: Date;
  
  if (typeof timestamp === 'number') {
    date = timestamp > 1000000000000 
      ? new Date(timestamp)
      : new Date(timestamp * 1000);
  } else {
    const num = parseInt(timestamp, 10);
    if (!isNaN(num) && num > 0) {
      date = num > 1000000000000 
        ? new Date(num)
        : new Date(num * 1000);
    } else {
      date = new Date(timestamp);
    }
  }
  
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 0) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (seconds > 10) return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  return 'just now';
};

/**
 * Format date: full date
 * Supports timestamp string (milliseconds) and ISO string
 */
export const formatDate = (timestamp: string | number | undefined | null): string => {
  if (!timestamp) return 'N/A';
  
  let date: Date;
  
  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    const num = parseInt(timestamp, 10);
    if (!isNaN(num) && num > 0) {
      date = num > 1000000000000 
        ? new Date(num)  
        : new Date(num * 1000);  
    } else {
      date = new Date(timestamp);
    }
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Copy to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
};

