import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/drapp';

type UserDoc = {
  _id: mongoose.Types.ObjectId;
  mobile: string;
  role: string;
  passwordHash?: string;
  preferredLocale?: 'en' | 'ta';
  name?: string;
  email?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

async function main() {
  const mobile = process.env.SEED_ADMIN_MOBILE;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL;

  if (!mobile || !password) {
    throw new Error('Missing SEED_ADMIN_MOBILE or SEED_ADMIN_PASSWORD');
  }

  const confirm = process.env.SEED_ADMIN_CONFIRM;
  if (confirm !== 'true') {
    throw new Error('Refusing to seed without SEED_ADMIN_CONFIRM=true');
  }

  await mongoose.connect(MONGO_URI);

  const users = mongoose.connection.collection<UserDoc>('users');

  const existingAdmin = await users.findOne({ role: 'admin' });
  if (existingAdmin) {
    // Idempotent: do nothing if an admin already exists.
    // eslint-disable-next-line no-console
    console.log('Admin already exists; skipping seed.');
    return;
  }

  const existingMobile = await users.findOne({ mobile });
  if (existingMobile) {
    throw new Error('Mobile already registered. Choose a different SEED_ADMIN_MOBILE.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const now = new Date();
  const doc: Omit<UserDoc, '_id'> = {
    mobile,
    role: 'admin',
    passwordHash,
    preferredLocale: 'en',
    name,
    email,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await users.insertOne(doc as any);

  // eslint-disable-next-line no-console
  console.log(`Seeded first admin user: ${mobile}`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
  });
