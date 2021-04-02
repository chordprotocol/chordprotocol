const LightningProtocol = artifacts.require("LightningProtocol");
const BigNumber = require('bignumber.js');

contract('LightningProtocolTest', async () => {
  let lightToken;

  before('setup', async ()=>{
    lightToken = await LightningProtocol.new(
        BigNumber(10000000000000000),
        8,
        500,
        1200,
        50,
        156,
        BigNumber(127500000000000),
        5000);
  });

  describe('name()', async  () => {
    it ('name getter', async () => {
      assert.equal(await lightToken.name(),'Lightning');
    });
  });
});