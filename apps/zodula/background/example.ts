export default $background(async (ctx) => {
    console.log("Running test background job");
    return {
        success: true,
        message: "Test background job completed successfully"
    };
});