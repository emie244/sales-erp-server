import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum CustomerLevel {
  A = 'A',
  B = 'B',
  C = 'C',
}

@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  contactName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: CustomerLevel, default: CustomerLevel.C })
  level: CustomerLevel;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ type: 'int', default: 0 })
  paymentTerms: number;

  @Column({ nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean;
}
