declare module 'better-tord' {
    function get_truth(): Promise<string>
    function get_dare(): Promise<string>
    export default { get_truth, get_dare }
}
