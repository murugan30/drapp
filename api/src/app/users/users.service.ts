import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role } from '../common/roles';
import { User, UserDocument } from './user.schema';
import { CreateStaffDto, UpdateUserLocaleDto, UpdateUserProfileDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async hasAnyAdmin() {
    const count = await this.userModel.countDocuments({ role: Role.Admin });
    return count > 0;
  }

  async createStaff(dto: CreateStaffDto) {
    if (dto.role === Role.Patient) {
      throw new BadRequestException('Patient users must register via the patient registration flow.');
    }
    const existing = await this.userModel.findOne({ mobile: dto.mobile });
    if (existing) {
      throw new BadRequestException('Mobile already registered.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      mobile: dto.mobile,
      role: dto.role,
      passwordHash,
      name: dto.name,
      email: dto.email,
    });
    return user;
  }

  async createPatientIfMissing(mobile: string) {
    const existing = await this.userModel.findOne({ mobile });
    if (existing) {
      return existing;
    }
    const user = await this.userModel.create({
      mobile,
      role: Role.Patient,
      preferredLocale: 'en',
    });
    return user;
  }

  async findByMobile(mobile: string, includePassword = false) {
    const query = this.userModel.findOne({ mobile });
    if (includePassword) {
      query.select('+passwordHash');
    }
    return query;
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setPasswordById(userId: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { passwordHash },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setPasswordByMobile(mobile: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userModel.findOneAndUpdate(
      { mobile },
      { passwordHash },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async listByRole(role?: Role) {
    return this.userModel.find(role ? { role } : {}).sort({ createdAt: -1 });
  }

  async listDoctorsPublic() {
    const docs = await this.userModel
      .find({ role: { $in: [Role.Doctor, Role.Admin] } })
      .select('_id name doctorProfile')
      .sort({ createdAt: -1 });
    return docs.map((d: any) => ({
      id: d._id.toString(),
      name: d.name || 'Doctor',
      slotMinutes: d.doctorProfile?.slotMinutes,
      doctorProfile: d.doctorProfile,
    }));
  }

  async updateLocale(userId: string, dto: UpdateUserLocaleDto) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { preferredLocale: dto.preferredLocale },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const update: any = { ...dto };
    if (dto.doctorProfile) {
      for (const [key, value] of Object.entries(dto.doctorProfile)) {
        update[`doctorProfile.${key}`] = value;
      }
      delete update.doctorProfile;
    }

    const user = await this.userModel.findByIdAndUpdate(userId, update, { new: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
