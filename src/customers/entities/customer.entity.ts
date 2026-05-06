import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CustomerAddress } from '../../customer-addresses/entities/customer-address.entity';

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

  @Column({
    name: 'prepayment_balance',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  prepaymentBalance: number;

  @OneToMany(() => CustomerAddress, (address) => address.customer)
  addresses: CustomerAddress[];

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;
}
