/* istanbul ignore file */
import { Factory } from 'rosie';
import { datatype, internet, phone } from 'faker';

export type User = {
  _id: number;
  name: string;
  age: number;
  phone: string;
};

export default Factory.define<User>('user')
  .sequence('_id')
  .attrs({
    name: internet.userName(),
    age: datatype.number({ min: 5, max: 80 }),
    phone: phone.phoneNumber(),
  });
