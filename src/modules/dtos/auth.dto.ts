import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class RegisterManagerDto {
  // Manager details
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  // Pharmacy details
  @IsString()
  @IsNotEmpty()
  pharmacyName: string;

  @IsString()
  @IsNotEmpty()
  pharmacyLocation: string;

  @IsEmail()
  @IsNotEmpty()
  pharmacyContactEmail: string;

  @IsString()
  @IsNotEmpty()
  pharmacyContactPhone: string;

}

export class LoginResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    pharmacy?: {
      id: string;
      name: string;
      status: string;
    };
  };
}