const Chord = artifacts.require("Chord");
const BigNumber = require('bignumber.js');
const Reverter = require('./helpers/reverter');
const truffleAssert = require('truffle-assertions');

contract('ChordTest', async (accounts) => {
    let chordToken;
    let chordTokenCycle;

    const OWNER = accounts[0];
    const SOMEBODY = accounts[1];
    const NOBODY = accounts[2];
    const ANYBODY = accounts[3];
    const DECIMAL_FACTOR = BigNumber(100000000);

    const reverter = new Reverter(web3);

    before('setup', async () => {
        chordToken = await Chord.new(
            BigNumber(100000000).multipliedBy(DECIMAL_FACTOR),
            8,
            500,
            1000,
            50,
            120,
            BigNumber(500000).multipliedBy(DECIMAL_FACTOR),
            5000,
            OWNER);
        chordTokenCycle = await Chord.new(
            BigNumber(100000000).multipliedBy(DECIMAL_FACTOR),
            8,
            500,
            1000,
            50,
            2,
            BigNumber(500000).multipliedBy(DECIMAL_FACTOR),
            5000,
            OWNER);
        await reverter.snapshot();
    });

    afterEach('revert', reverter.revert);

    describe('redistribution tests', async()=>{
        it('check that balance changes only when rebase', async()=>{
            //250000 fee
            await chordToken.transfer(SOMEBODY, BigNumber(5000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(100000000 - 250000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), BigNumber(5000000-250000).multipliedBy(DECIMAL_FACTOR).toString());
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(750).toString());

            //225000 fee
            await chordToken.transfer(NOBODY, BigNumber(3000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(1000).toString());
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(100000000 - 250000 - 225000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), BigNumber(5000000-250000).multipliedBy(DECIMAL_FACTOR).toString());

            await chordToken.transfer(NOBODY, BigNumber(250000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(100000000 - 250000).multipliedBy(DECIMAL_FACTOR));

            //assert that balance is greater for percentage
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (BigNumber(5000000-250000).multipliedBy(DECIMAL_FACTOR).plus(((BigNumber(5000000-250000).multipliedBy(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(BigNumber(await chordToken.totalSupply()).minus(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))))).toString());
        });
        it('test double percentage redistribution', async()=>{
            await chordToken.transfer(SOMEBODY, BigNumber(10000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(100000000 - 250000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), BigNumber(9500000).multipliedBy(DECIMAL_FACTOR).plus((BigNumber(9500000 * 250000).multipliedBy(DECIMAL_FACTOR).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(BigNumber(100000000 - 500000).multipliedBy(DECIMAL_FACTOR))).toString());
        });
    });

    describe('transfer()', async () => {
        it('fee doesnt change when amount less than change', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(1) * DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(0).toString());
            //1 token - 5% is 5 / 100
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (BigNumber(1) * DECIMAL_FACTOR - (BigNumber(5) * DECIMAL_FACTOR) / 100).toString());
        });
        it('fee change one step', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(1500000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(550).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(0).toString());
            //with the fee of 5%
            let previousBalance = (BigNumber(1500000).multipliedBy(DECIMAL_FACTOR)).minus(BigNumber(75000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), previousBalance.toString());

            await chordToken.transfer(SOMEBODY, BigNumber(1500000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(650).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(0).toString());
            //other fee + previous balance
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), previousBalance.plus((BigNumber(1500000).multipliedBy(DECIMAL_FACTOR)).minus(BigNumber(82500).multipliedBy(DECIMAL_FACTOR))).toString());
        });
        it('fee switch cycle and stay same', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(10000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(500000).multipliedBy(DECIMAL_FACTOR).minus(await chordToken.amount_for_redistribution())).toString());

            let totalSupply = BigNumber(100000000 - 500000 + 250000).multipliedBy(DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), totalSupply.toString());

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), ((BigNumber(9500000).multipliedBy(DECIMAL_FACTOR)).plus((BigNumber(9500000).multipliedBy(DECIMAL_FACTOR).multipliedBy(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))).dividedToIntegerBy(totalSupply.minus(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))))).toString());
        });
        it('fee over two cycles, but switch to only one, stay the same, supply changed by fee sum', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(20500000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(1025000).multipliedBy(DECIMAL_FACTOR).minus(await chordToken.amount_for_redistribution())).toString());

            let totalSupply = BigNumber(100000000 - 1025000 + 250000).multipliedBy(DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), totalSupply.toString());

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (BigNumber(19475000).multipliedBy(DECIMAL_FACTOR).plus(((BigNumber(19475000).multipliedBy(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(totalSupply.minus(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))))).toString());
        });
        it('fee over two cycles, but switch to only one, doesnt stay, next small transaction causes burn', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(22000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(600).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(1100000).multipliedBy(DECIMAL_FACTOR).minus(await chordToken.amount_for_redistribution())).toString());

            let totalSupply = BigNumber(100000000 - 1100000 + 250000).multipliedBy(DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), totalSupply.toString());

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (BigNumber(20900000).multipliedBy(DECIMAL_FACTOR).plus(((BigNumber(250000).multipliedBy(BigNumber(20900000).multipliedBy(DECIMAL_FACTOR))).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(totalSupply.minus(BigNumber(250000).multipliedBy(DECIMAL_FACTOR))))).toString());

            await chordToken.transfer(SOMEBODY, BigNumber(1000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(600).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(2).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(1100000 + 60).multipliedBy(DECIMAL_FACTOR).minus(BigNumber(await chordToken.amount_for_redistribution()).multipliedBy(BigNumber(2)))).toString());
        });
        it('transact without fee when cycle finished', async () => {
            await chordTokenCycle.transfer(SOMEBODY, BigNumber(10000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordTokenCycle._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordTokenCycle._getBurnFee()).toString(), BigNumber(500).toString());
            await chordTokenCycle.transfer(SOMEBODY, BigNumber(10000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordTokenCycle._getCycle()).toString(), BigNumber(2).toString());
            assert.equal(BigNumber(await chordTokenCycle._getBurnFee()).toString(), BigNumber(0).toString());
        });
        it('transact without fee when burned tocken amount more than has to be', async () => {
            await chordTokenCycle.transfer(SOMEBODY, BigNumber(50000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordTokenCycle._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordTokenCycle._getBurnFee()).toString(), BigNumber(0).toString());
        });
    });
    describe('includeAccount()', async () => {
        it('must revert on included', async () => {
            await truffleAssert.reverts(chordToken.includeAccount(SOMEBODY), 'Account is already included');
        });
    });
    describe('excludeAccount()', async () => {
        it('must revert on excluded', async () => {
            await chordToken.excludeAccount(SOMEBODY);
            await truffleAssert.reverts(chordToken.excludeAccount(SOMEBODY), 'Account is already excluded');
        });
        it('excluded accounts get profit', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(1000).multipliedBy(DECIMAL_FACTOR));
            await chordToken.excludeAccount(NOBODY);
            await chordToken.transfer(NOBODY, BigNumber(1000).multipliedBy(DECIMAL_FACTOR));

            //force cycle change
            await chordToken.transfer(ANYBODY, BigNumber(11000000).multipliedBy(DECIMAL_FACTOR));

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).comparedTo(BigNumber(await chordToken.balanceOf(NOBODY))), 1);
        });
    });
    describe('CHORD parameters test', async () => {
        it('500 000 CHORDS are burned each cycle', async () => {
            assert.equal(BigNumber(await chordToken.amount_to_burn()).toString(), (BigNumber(500000).multipliedBy(DECIMAL_FACTOR)).toString());
        });
        it('fee raises from 5% to 10%', async () => {
            assert.equal(BigNumber(await chordToken.fee_left_range()).toString(), BigNumber(500).toString());
            assert.equal(BigNumber(await chordToken.fee_right_range()).toString(), BigNumber(1000).toString());
        });
        it('cycles equal to 120', async () => {
            assert.equal(BigNumber(await chordToken.total_cycle_amount()).toString(), BigNumber(120).toString());
        });
        it('500 000 CHORDS are burned and 250 000 are reminted, with initial total supply 100 000 000', async () => {
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(100000000).multipliedBy(DECIMAL_FACTOR).toString());

            await chordToken.transfer(SOMEBODY, BigNumber(10000000).multipliedBy(DECIMAL_FACTOR));

            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());

            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(100000000 - 250000).multipliedBy(DECIMAL_FACTOR).toString());
        });
        it('amount of burned tokens equals to 30 000 000, final supply equals to 70 000 000', async () => {
            var t = BigNumber(0);
            var cycles = await chordToken.total_cycle_amount();
            var amountToTransfer = BigNumber(10000000).multipliedBy(DECIMAL_FACTOR);

            assert.equal(BigNumber(await chordToken.balanceOf(OWNER)).toString(), (BigNumber(100000000).multipliedBy(DECIMAL_FACTOR)).toString());

            while (t.comparedTo(cycles) == -1) {
                var ownerBalance = BigNumber(await chordToken.balanceOf(OWNER));
                var i , j;
                i = ownerBalance.dividedToIntegerBy(amountToTransfer);

                i = i.minus(BigNumber(1));

                for (; i.comparedTo(BigNumber(0)) == 1; i = i.minus(BigNumber(1))) {
                    if(t.comparedTo(cycles) != -1){
                        break;
                    }
                    assert.equal(BigNumber(await chordToken._getCycle()).toString(), t.toString());
                    await chordToken.transfer(SOMEBODY, amountToTransfer);
                    t = t.plus(BigNumber(1));
                }

                var somebodyBalance = BigNumber(await chordToken.balanceOf(SOMEBODY));
                j = somebodyBalance.dividedToIntegerBy(amountToTransfer);

                for (; j.comparedTo(BigNumber(0)) == 1; j = j.minus(BigNumber(1))) {
                    if(t.comparedTo(cycles) != -1){
                        break;
                    }
                    await chordToken.transfer(OWNER, amountToTransfer, {from: SOMEBODY});
                    t = t.plus(BigNumber(1));
                    assert.equal(BigNumber(await chordToken._getCycle()).toString(), t.toString());
                }
            }

            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(120).toString());
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(0).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), BigNumber(30000000).multipliedBy(DECIMAL_FACTOR).toString());
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), BigNumber(70000000).multipliedBy(DECIMAL_FACTOR).toString());

            //rounding to the bigger value, as because of division, in _getRate(), we are getting final numbers 6999...99(9)
            assert.equal((BigNumber(70000000).multipliedBy(DECIMAL_FACTOR)).toPrecision(15, 0).toString(), (BigNumber(await chordToken.balanceOf(OWNER)).plus(BigNumber(await chordToken.balanceOf(SOMEBODY)))).toPrecision(15, 0).toString());
        });
    });
})
;