import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Tenant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column("text", { array: true })
    currencies: string[];

    @Column()
    defaultCurrency: string;

    // Relations (addresses, contacts, etc.) can be added later with @OneToMany, etc.
}