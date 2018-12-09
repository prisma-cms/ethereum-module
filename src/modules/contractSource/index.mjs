
import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";

import solc from "solc";
import chalk from "chalk";



export class EthContractSourceProcessor extends PrismaProcessor {


  constructor(props) {

    super(props);

    this.objectType = "ethContractSource";

  }


  async create(objectType, args, info) {

    const {
      data: {
        ...data
      },
    } = args;

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
    } = currentUser || {};


    Object.assign(args, {
      data: {
        ...data,
        CreatedBy: {
          connect: {
            id: currentUserId,
          },
        },
      },
    });

    return super.create(objectType, args, info)
  }


  async update(objectType, args, info) {

    const {
      where,
    } = args;

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
    } = currentUser || {};


    const contractSource = await this.query("ethContractSource", {
      where,
    }, `{
      id
      CreatedBy{
        id
      }
    }`);

    const {
      CreatedBy: {
        id: createdById,
      },
    } = contractSource;



    if (!createdById || createdById !== currentUserId) {
      return this.addError("Нельзя редактировать чужой контракт");
    }


    return super.update(objectType, args, info)
  }


  async mutate(method, args, info) {

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
    } = currentUser || {};

    if (!currentUserId) {
      return this.addError("Необходимо авторизоваться");
    }


    let {
      data: {
        name,
        ...data
      },
    } = args;


    if (name !== undefined) {

      name = name.trim();

      if (!name) {
        this.addFieldError("name", "Не заполнено название контракта");
      }

    }

    args.data = {
      ...data,
      name,
    }

    return super.mutate(method, args);

  }



  async deployEthContractSourceProcessor(objectType, args, info) {

    let {
      where,
      data: {
        password,
        ...data
      },
      ...otherArgs
    } = args;

    const {
      currentUser,
      db,
    } = this.ctx;

    const {
      id: currentUserId,
      // ethWallet: from,
    } = currentUser || {};


    if (!currentUserId) {
      return this.addError("Необходимо авторизоваться");
    }

    const user = await db.query.user({
      where: {
        id: currentUserId,
      },
    }, `{
      id
      EthAccounts{
        id
        address,
      }
    }`);


    if (!user) {
      return this.addError("Не был получен пользователь");
    }

    const {
      address: from,
    } = user.EthAccounts && user.EthAccounts[0] || {};


    if (!from) {
      return this.addError("Не был получен кошелек пользователя");
    }


    const contractSource = await this.query("ethContractSource", {
      where,
    }, `{
      id
      name
      source
      CreatedBy{
        id
      }
    }`);

    const {
      id: contractSourceId,
      name,
      source,
      CreatedBy: {
        id: createdById,
      },
    } = contractSource;





    if (!createdById || createdById !== currentUserId) {
      this.addError("Нельзя деплоить чужой контракт");
    }

    else if (!from) {
      this.addError("Не был получен кошелек пользователя");
    }

    else if (!source) {
      this.addError("Не был получен исходный код контракта");
    }

    else if (!password) {
      this.addFieldError("password", "Не указан пароль для кошелька");
    }

    else {


      let contractSourcesSource;


      try {
        contractSourcesSource = solc.compile(source);
      }
      catch (error) {


        throw (error);
      }



      let contractSources = [];

      if (contractSourcesSource) {

        for (var contractSourceName in contractSourcesSource.contractSources) {

          const contractSource = contractSourcesSource.contractSources[contractSourceName];

          let {
            interface: contractSourceInterface,
          } = contractSource;

          if (contractSourceInterface) {

            try {

              contractSourceInterface = JSON.parse(contractSourceInterface);

            }
            catch (e) {
              console.error
            }

          }

          // code and ABI that are needed by web3



          contractSources.push({
            ...contractSource,
            name: contractSourceName.replace(/^:*/, ''),
            abi: contractSourceInterface,
          });

        }
      }

      let contractSourceForDeploy = contractSources.find(n => n.name === name);






      // return;

      if (!contractSourceForDeploy) {
        this.addFieldError("name", "Не был получен публикуемый контракт");
      }
      else {

        const {
          abi,
          bytecode,
        } = contractSourceForDeploy;



        await this.ethDeployContractSource({
          abi,
          bytecode,
          from,
          password,
        })
          .then(deployResult => {



            const {
              newContractSourceInstance,
              txHash,
            } = deployResult;




            const {
              _jsonInterface,
              _address,
            } = newContractSourceInstance;

            Object.assign(data, {
              Deployed: {
                create: {
                  name,
                  source,
                  address: _address,
                  txHash,
                  bytecode,
                  abi: _jsonInterface,
                  CreatedBy: {
                    connect: {
                      id: currentUserId,
                    },
                  },
                },
              },
            });

          });


      }

    }


    args = {
      where,
      data: {
        ...data
      },
      ...otherArgs
    };


    return this.updateWithResponse(objectType, args, info)
  }



  async ethDeployContractSource(args) {

    const {
      web3,
    } = this.ctx;

    let {
      abi: contractSourceInterface,
      bytecode,
      params,
      from,
      password,
      gas = 3000000,
      gasPrice = 10 ** 9,
    } = args;

    // Если не указано от кого, выполняет от базового аккаунта
    if (!from) {

      // const coinbase = await web3.eth.getCoinbase()
      //   .then(r => r)
      //   .catch(e => {
      //     throw (e);
      //   });

      // if (!coinbase) {
      //   throw (new Error("Can not get coinbase"));
      // }

      // from = coinbase;

      throw (new Error("Не был получен кошелек пользователя"));
    }


    // const contractSourceSource = await contractSource(source, args, ctx).then(r => r).catch(e => {
    //   throw (e);
    // });




    var myContractSource = new web3.eth.ContractSource(contractSourceInterface);





    if (password) {
      const unlockResult = await web3.eth.personal.unlockAccount(from, password)
        .catch(e => {
          throw (e);
        });
    }

    return new Promise((resolve, reject) => {

      const data = `0x${bytecode}`;

      let txHash;

      myContractSource.deploy({
        data,
        arguments: params,
      })
        .send({
          from,
          gas,
          gasPrice,
        }, function (error, transactionHash) {

        })
        .on('error', function (error) {


          reject(error);

        })
        .on('transactionHash', function (transactionHash) {

          txHash = transactionHash;
        })
        .on('receipt', function (receipt) {

        })
        .on('confirmation', function (confirmationNumber, receipt) {

        })
        .then(function (newContractSourceInstance) {



          resolve({
            newContractSourceInstance,
            txHash,
          });
        });



    });

  }


}



const ethContractSource = async function (source, args, ctx, info) {


  const {
    name,
  } = args;

  const result = await ethContractSources(source, args, ctx);


  return result ? result.find(n => n.name === name) : null;
}


const ethContractSourceByAddress = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;


  const {
    address,
  } = args;


  const contractSourceSource = await contractSource(source, args, ctx).then(r => r).catch(e => {
    throw (e);
  });

  if (!contractSourceSource) {
    throw ("Can not get contractSource");
  }

  const {
    abi: contractSourceInterface,
    bytecode,
  } = contractSourceSource;


  var myContractSource = new web3.eth.ContractSource(contractSourceInterface);


  return new Promise((resolve, reject) => {


    myContractSource.options.address = address;



    resolve(myContractSource);

  });

}


const callContractSourceMethod = async function (contractSourceMethod, source, args, ctx, info) {



  let {
    method,
    params,
    from,
  } = args;

  const {
    web3,
  } = ctx;

  const contractSource = await ethContractSourceByAddress(source, args, ctx);

  if (!contractSource) {
    throw (new Error("Can not get contractSource"));
  }


  if (!from) {

    const coinbase = await web3.eth.getCoinbase()
      .then(r => r)
      .catch(e => {
        throw (e);
      });

    if (!coinbase) {
      throw (new Error("Can not get coinbase"));
    }
    ;

    from = coinbase;
  }

  const {
    methods,
  } = contractSource;

  if (!methods || !methods[method]) {
    throw (new Error("Can not get method"));
  }

  const result = await methods[method].apply(this, params)[contractSourceMethod]({
    from,
    gas: 3000000,
  })
    .then(r => r)
    .catch(error => {
      throw (error);
    });



  return result;
}


const mint = async function (source, args, ctx, info) {

  const {
    masterPassword,
    to,
    amount,
    ...other
  } = args;

  const {
    web3,
  } = ctx;



  const coinbase = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  if (!coinbase) {
    throw (new Error("Can not get coinbase"));
  }


  const unlockResult = await web3.eth.personal.unlockAccount(coinbase, masterPassword)
    .catch(e => {
      throw (e);
    });





  const result = await ethContractSourceRead(source, {
    ...other,
    method: "mint",
    params: [to, amount],
  }, ctx, info);



  return result;
}


const ethChargeUserBalance = async function (source, args, ctx, info) {

  const {
    masterPassword,
    to,
    amount,
    ...other
  } = args;

  const {
    web3,
  } = ctx;



  const coinbase = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  if (!coinbase) {
    throw (new Error("Can not get coinbase"));
  }


  const unlockResult = await web3.eth.personal.unlockAccount(coinbase, masterPassword)
    .catch(e => {
      throw (e);
    });





  const result = await ethContractSourceRead(source, {
    ...other,
    method: "ethChargeUserBalance",
    params: [to, amount],
  }, ctx, info);



  return result;
}

const ethContractSourceCall = async function (source, args, ctx, info) {

  return callContractSourceMethod("call", source, args, ctx, info);
}

const ethContractSourceRead = async function (source, args, ctx, info) {

  return callContractSourceMethod("send", source, args, ctx, info);
}





class ContractSourceModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      // ethContractSource,
      // ethContractSources: this.ethContractSources,
      // ethContractSourceByAddress,

      ethContractSourcesConnection: this.ethContractSourcesConnection,
      ethContractSources: this.ethContractSources,
      ethContractSource: this.ethContractSource,

      // ethDeployedContractSourcesConnection: this.ethDeployedContractSourcesConnection,
      // ethDeployedContractSources: this.ethDeployedContractSources,
      // ethDeployedContractSource: this.ethDeployedContractSource,

    };

    this.Mutation = {
      // ethDeployContractSource,
      // ethContractSourceCall,
      // ethContractSourceRead,
      // mint,
      // ethChargeUserBalance,
      createEthContractSourceProcessor: this.createEthContractSourceProcessor.bind(this),
      updateEthContractSourceProcessor: this.updateEthContractSourceProcessor.bind(this),
      // deployEthContractSourceProcessor: this.deployEthContractSourceProcessor.bind(this),
    }

    this.EthContractSourceResponse = {
      data: (source, args, ctx, info) => {

        const {
          id,
        } = source.data || {};

        return id ? ctx.db.query.ethContractSource({
          where: {
            id,
          },
        }, info) : null;
      }
    }
  }



  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return EthContractSourceProcessor;
  }


  createEthContractSourceProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("EthContractSource", args, info);
  }

  updateEthContractSourceProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("EthContractSource", args, info);
  }

  deployEthContractSourceProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).deployEthContractSourceProcessor("EthContractSource", args, info);
  }


  async ethContractSourcesConnection(source, args, ctx, info) {
    return ctx.db.query.ethContractSourcesConnection(args, info);
  }

  async ethContractSources(source, args, ctx, info) {
    return ctx.db.query.ethContractSources(args, info);
  }

  async ethContractSource(source, args, ctx, info) {
    return ctx.db.query.ethContractSource(args, info);
  }


  async ethDeployedContractSourcesConnection(source, args, ctx, info) {
    return ctx.db.query.ethDeployedContractSourcesConnection(args, info);
  }

  async ethDeployedContractSources(source, args, ctx, info) {
    return ctx.db.query.ethDeployedContractSources(args, info);
  }

  async ethDeployedContractSource(source, args, ctx, info) {
    return ctx.db.query.ethDeployedContractSource(args, info);
  }

  // async ethContractSources(source, args, ctx, info) {

  //   const {
  //     contractSourcesSource,
  //   } = ctx;

  //   let contractSources = [];


  //   const contractSourceSol = `

  //   `;


  //   var output = solc.compile(contractSourceSol.toString());




  //   if (contractSourcesSource) {

  //     for (var contractSourceName in contractSourcesSource.contractSources) {

  //       const contractSource = contractSourcesSource.contractSources[contractSourceName];

  //       let {
  //         abi: contractSourceInterface,
  //       } = contractSource;

  //       if (contractSourceInterface) {

  //         try {

  //           contractSourceInterface = JSON.parse(contractSourceInterface);

  //         }
  //         catch (e) {
  //           console.error
  //         }

  //       }

  //       contractSources.push({
  //         ...contractSource,
  //         name: contractSourceName.replace(/^:*/, ''),
  //         abi: contractSourceInterface,
  //       });

  //     }
  //   }

  //   return contractSources;
  // }



  // EthContractSourceResponse() {

  //   return {
  //     data: (source, args, ctx, info) => {

  //       const {
  //         id,
  //       } = source.data || {};

  //       return id ? ctx.db.query.ethContractSource({
  //         where: {
  //           id,
  //         },
  //       }, info) : null;
  //     }
  //   }
  // }


  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      EthContractSourceResponse: this.EthContractSourceResponse,
    });

    return resolvers;
  }

}

export default ContractSourceModule;
