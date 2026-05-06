import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';

@Entity('customer_addresses')
export class CustomerAddress extends BaseEntity {
  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.addresses)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column()
  consignee: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  province: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ name: 'detail_address', nullable: true })
  detailAddress: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;
}
