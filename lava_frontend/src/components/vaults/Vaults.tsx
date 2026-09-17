export const ValidatorHeader = () => {
  return (
    <div>
      <h1 className="text-5xl md:text-6xl font-bold mb-6">
        LAVA <span className="text-gradient-lava">VAULTS</span>
      </h1>
      <p
        className="text-muted-foreground mb-8 max-w-lg"
        style={{
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
          fontWeight: 400,
          fontStyle: 'normal',
          fontSize: '18px',
          lineHeight: '150%',
          letterSpacing: '-0.02em',
          //leadingTrim: 'none',
        }}
      >
        Lorem ipsum dolor sit amet consectetur. Placerat pharetra aliquam fusce quis semper. 
        Neque enim amet blandit nunc leo non at vitae rhoncus. Sapien amet aliquet sit lectus euismod 
        non orci aliquet aliquam. Velit ut molestie a commodo.
      </p>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <p
            className="text-sm mb-2"
            style={{
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              fontWeight: 400,
              fontStyle: 'normal',
              lineHeight: '150%',
              letterSpacing: '-0.02em',
              color: 'var(--Color-4, #666666)',
              //leadingTrim: 'none',
            }}
          >
            Total Lava Stake
          </p>
          <p
            className="text-2xl sm:text-3xl md:text-4xl font-bold"
            style={{
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              fontWeight: 400,
              fontStyle: 'normal',
              lineHeight: '150%',
              letterSpacing: '-0.02em',
              //leadingTrim: 'none',
            }}
          >
            12,432 <span className="text-muted-foreground" style={{
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              fontWeight: 400,
              fontStyle: 'normal',
              lineHeight: '150%',
              letterSpacing: '-0.02em',
              //leadingTrim: 'none',
            }}>ADA</span>
          </p>
        </div>
        <div>
          <p
            className="text-sm mb-2"
            style={{
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              fontWeight: 400,
              fontStyle: 'normal',
              lineHeight: '150%',
              letterSpacing: '-0.02em',
              color: 'var(--Color-4, #666666)',
             // leadingTrim: 'none',
            }}
          >
            Block Height
          </p>
          <p
            className="text-2xl sm:text-3xl md:text-4xl font-bold"
            style={{
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              fontWeight: 400,
              fontStyle: 'normal',
              lineHeight: '150%',
              letterSpacing: '-0.02em',
              //leadingTrim: 'none',
            }}
          >
            132,543,321
          </p>
        </div>
      </div>
    </div>
  );
};
