const Jimp = require('jimp');

async function processImage() {
    try {
        const inputPath = process.argv[2];
        const outputPath = process.argv[3];
        console.log(`Processing ${inputPath} to ${outputPath}...`);

        const image = await Jimp.read(inputPath);

        // Find min and max brightness to normalize the alpha correctly
        let minBright = 255;
        let maxBright = 0;

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const bright = (r + g + b) / 3;
            if (bright < minBright) minBright = bright;
            if (bright > maxBright) maxBright = bright;
        });

        if (maxBright === minBright) maxBright = minBright + 1;

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const a = this.bitmap.data[idx + 3];

            const bright = (r + g + b) / 3;
            let alpha = 255 - (((bright - minBright) / (maxBright - minBright)) * 255);
            alpha = Math.max(0, Math.min(255, Math.round(alpha)));

            // Multiply by original alpha
            alpha = Math.round(alpha * (a / 255));

            this.bitmap.data[idx + 0] = 255; // R
            this.bitmap.data[idx + 1] = 255; // G
            this.bitmap.data[idx + 2] = 255; // B
            this.bitmap.data[idx + 3] = alpha; // A
        });

        await image.writeAsync(outputPath);
        console.log('Done!');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

processImage();
