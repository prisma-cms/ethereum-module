

import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";

const ethCoinbase = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;


  const result = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  // console.log("accounts", result);

  return result ? {
    address: result,
  } : null;
}


/**
 * Для получения общих аккаунтов и персональных служат разные методы
 */
const getAccounts = async function (method, source, args, ctx, info) {

  const result = await method()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  console.log("accounts", result);

  return result ? result.map(address => ({ address })) : [];
}


// const ethAccounts = async function (source, args, ctx, info) {

//   const {
//     web3,
//   } = ctx;

//   return getAccounts(web3.eth.getAccounts);
// }


const ethPersonalAccounts = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;

  return getAccounts(web3.eth.personal.getAccounts);
}


const balance = async function (source, args, ctx, info) {

  const {
    address,
  } = source;

  if (!address) {
    return null;
  }

  return ethBalance(source, {
    ...args,
    address,
  }, ctx, info);

}


const ethBalance = async function (source, args, ctx, info) {

  const {
    address,
    convert,
  } = args;

  const {
    web3,
  } = ctx;


  let result = await web3.eth.getBalance(address)
    .then(balance => {

      console.log("balance", balance, typeof balance);

      if (balance) {

        // switch (convert) {

        //   case 'ether':

        //     balance = web3.utils.fromWei(balance, 'ether');
        //     break;

        // }

        balance = web3.utils.fromWei(balance, convert);

      }

      return balance;

    })
    .catch(e => {
      throw (e);
    });



  console.log("result", result);

  return result || null;
}

const ethUnlockPersonalAccount = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;

  const {
    address,
    password,
    duration,
  } = args;


  const unlockResult = await web3.eth.personal.unlockAccount(address, password, duration)
    .catch(e => {
      throw (e);
    });

  // console.log("result", unlockResult);

  return unlockResult;
}




export class PersonalAccountProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "PersonalAccount";

  }


  async create(objectType, args, info) {

    const {
      web3,
    } = this.ctx;

    const {
      data: {
        password,
      },
    } = args;

    // Регистрируем новый кошелек
    const address = await web3.eth.personal.newAccount(password)
      .then(r => r)
      .catch(e => {
        throw (e)
      });

    return {
      address,
    }

  }

}


class AccountModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      ethCoinbase,
      ethAccount: this.ethAccount,
      ethAccounts: this.ethAccounts,
      ethAccountsConnection: this.ethAccountsConnection,
      ethPersonalAccounts,
      ethBalance,
    };

    this.Mutation = {
      ethUnlockPersonalAccount,
      ethCreatePersonalAccountProcessor: this.ethCreatePersonalAccountProcessor.bind(this),
    }
  };



  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return PersonalAccountProcessor;
  }


  ethCreatePersonalAccountProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("PersonalAccount", args, info);
  }


  ethAccount(source, args, ctx, info) {

    return ctx.db.query.ethAccount(args, info);
  }


  ethAccounts(source, args, ctx, info) {

    return ctx.db.query.ethAccounts(args, info);
  }


  ethAccountsConnection(source, args, ctx, info) {
    
    return ctx.db.query.ethAccountsConnection(args, info);
  }




  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      EthAccount: {
        balance: balance,
      },
      EthPersonalAccount: {
        balance: balance,
      },
    });

    return resolvers;
  }

}

export default AccountModule;