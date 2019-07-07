
import Module from "./modules";


import EthAccountModule, {
  EthAccountProcessor,
} from "./modules/account";

export {
  EthAccountModule,
  EthAccountProcessor,
};


import EthPersonalAccountModule, {
  EthPersonalAccountProcessor,
} from "./modules/personalAccount";

export {
  EthPersonalAccountModule,
  EthPersonalAccountProcessor,
};


export const Modules = [
  EthAccountModule,
  EthPersonalAccountModule,
];

export default Module
