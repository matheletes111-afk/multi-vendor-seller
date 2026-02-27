import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date))
}



// Slug generation
export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Delete image file
export async function deleteImageFile(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) {
      return false;
    }
    
    const filePath = path.join(process.cwd(), 'public', imageUrl);
    if (existsSync(filePath)) {
      await unlink(filePath);
      console.log(`Deleted image: ${imageUrl}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
}

// Save base64 image to file system
export async function saveBase64Image(base64String: string, folder: string): Promise<string | null> {
  try {
    // Check if it's a valid base64 image
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.log("Invalid base64 image format");
      return null;
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    const mimeType = matches[1];
    const extension = mimeType.split('/')[1];
    
    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Create full path
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    const filePath = path.join(uploadDir, fileName);
    
    // Ensure directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
      console.log(`Created directory: ${uploadDir}`);
    }
    
    // Write file
    await writeFile(filePath, imageBuffer);
    console.log(`Saved image: ${filePath}`);
    
    // Return the public URL path
    return `/uploads/${folder}/${fileName}`;
  } catch (error) {
    console.error("Error saving image:", error);
    return null;
  }
}