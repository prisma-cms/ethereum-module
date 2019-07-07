

import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";
import chalk from "chalk";


export class EthAccountProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "EthAccount";

    this.private = true;
  }


  async create(method, args, info) {

    if (args.data) {

      let {
        ...data
      } = args.data;


      Object.assign(data, {
      });

      args.data = data;

    }

    const {
      id: currentUserId,
    } = await this.getUser(true);


    Object.assign(args.data, {
      CreatedBy: {
        connect: {
          id: currentUserId,
        },
      },
    });


    return super.create(method, args, info);
  }


  async update(method, args, info) {

    if (args.data) {

      let {
        CreatedBy,
        ...data
      } = args.data;

      args.data = data;

    }

    return super.update(method, args, info);
  }


  async mutate(method, args, info) {

    // console.log("createAccount args", JSON.stringify(args, true, 2));

    if (args.data) {

      let {
        address,
        ...data
      } = args.data;


      if (address !== undefined) {

        address = address && address.trim() || null;

        if (!address) {
          this.addFieldError("address", "Address can not be empty");
        }
        else if (!address.startsWith("0x")) {
          this.addFieldError("address", "Address should to be starts with 0x");
        }

      }


      Object.assign(data, {
        address,
      });

      args.data = data;

    }

    await this.checkPermission(method, args, info);

    // console.log("createAccount args.data", JSON.stringify(args.data, true, 2));

    // this.addError("Debug");

    return super.mutate(method, args);
  }


  async delete(method, args, info) {

    return super.delete(method, args);
  }
}



class EthAccountModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      ethAccount: this.ethAccount,
      ethAccounts: this.ethAccounts,
      ethAccountsConnection: this.ethAccountsConnection,
    };

    this.Mutation = {
      createEthAccountProcessor: this.createEthAccountProcessor.bind(this),
      updateEthAccountProcessor: this.updateEthAccountProcessor.bind(this),
    }
  };


  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return EthAccountProcessor;
  }


  createEthAccountProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("EthAccount", args, info);
  }


  updateEthAccountProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("EthAccount", args, info);
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
      EthAccountResponse: {
        data: (source, args, ctx, info) => {

          const {
            id,
          } = source.data || {};

          return id ? ctx.db.query.ethAccount({
            where: {
              id,
            },
          }, info) : null;
        },
      },
      EthAccount: {
        balance: (source, args, ctx, info) => {

          // console.log("resolvers", ctx.resolvers);

          const {
            resolvers: {
              Query: {
                ethBalance,
              },
            },
          } = ctx;

          return ethBalance(source, args, ctx, info);

        },
      },
    });

    return resolvers;
  }

}

export default EthAccountModule;