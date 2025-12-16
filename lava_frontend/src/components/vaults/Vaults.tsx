export const ValidatorHeader = () => {
  return (
    <div>
      <h1 className="text-5xl md:text-6xl font-bold mb-6">
        Lava <span className="text-gradient-lava">Vaults</span>
      </h1>
      <p className="text-muted-foreground mb-8 max-w-lg">
        Lorem ipsum dolor sit amet consectetur. Placerat pharetra aliquam fusce quis semper. 
        Neque enim amet blandit nunc leo non at vitae rhoncus. Sapien amet aliquet sit lectus euismod 
        non orci aliquet aliquam. Velit ut molestie a commodo.
      </p>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-primary text-sm mb-2">Total Lava Stake</p>
          <p className="text-4xl font-bold">
            12,432 <span className="text-muted-foreground">ADA</span>
          </p>
        </div>
        <div>
          <p className="text-primary text-sm mb-2">Block Height</p>
          <p className="text-4xl font-bold">132,543,321</p>
        </div>
      </div>
    </div>
  );
};
