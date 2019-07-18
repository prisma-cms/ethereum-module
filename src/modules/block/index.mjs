

import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";
import chalk from "chalk";


export class EthBlockProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "EthBlock";

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



class EthBlockModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      ethBlock: this.ethBlock,
      ethBlocks: this.ethBlocks,
      ethBlocksConnection: this.ethBlocksConnection,
    };

    this.Mutation = {
      // createEthBlockProcessor: this.createEthBlockProcessor.bind(this),
      // updateEthBlockProcessor: this.updateEthBlockProcessor.bind(this),
    }
  };


  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return EthBlockProcessor;
  }


  createEthBlockProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("EthBlock", args, info);
  }


  updateEthBlockProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("EthBlock", args, info);
  }


  ethBlock(source, args, ctx, info) {

    return ctx.db.query.ethBlock(args, info);
  }


  ethBlocks(source, args, ctx, info) {

    return ctx.db.query.ethBlocks(args, info);
  }


  ethBlocksConnection(source, args, ctx, info) {

    return ctx.db.query.ethBlocksConnection(args, info);
  }




  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      EthBlockResponse: {
        data: (source, args, ctx, info) => {

          const {
            id,
          } = source.data || {};

          return id ? ctx.db.query.ethBlock({
            where: {
              id,
            },
          }, info) : null;
        },
      },
      EthBlock: {
        // balance: (source, args, ctx, info) => {

        //   // console.log("resolvers", ctx.resolvers);

        //   const {
        //     resolvers: {
        //       Query: {
        //         ethBalance,
        //       },
        //     },
        //   } = ctx;

        //   return ethBalance(source, args, ctx, info);

        // },
      },
    });

    return resolvers;
  }

}

export default EthBlockModule;