import DefaultPoolEvent, { ProcessPairEvent } from "./DefaultPoolEvent";

class MintEvent extends DefaultPoolEvent {
  constructor(poolId: string, eventId: string, timestamp: string) {
    super(poolId, eventId, timestamp, 'Mint');
  }

  async process(event: ProcessPairEvent): Promise<void> {
    await super.process(event);
    this.sender_address = event.data.args[0];
    this.amount_1 = event.data.args[1].toString();
    this.amount_2 = event.data.args[2].toString();
  }
}

export default MintEvent;